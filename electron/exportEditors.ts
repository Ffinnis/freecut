import { writeFile } from 'fs/promises';
import { pathToFileURL } from 'url';

interface ExportSegment {
  start: number;
  end: number;
}

interface FcpMediaInfo {
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function secondsToTimecode(seconds: number, fps: number): string {
  const nominalFps = Math.round(fps);
  const totalFrames = Math.round(seconds * fps);
  const f = totalFrames % nominalFps;
  const totalSeconds = Math.floor(totalFrames / nominalFps);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
    String(f).padStart(2, '0')
  ].join(':');
}

export function generateEdl(
  segments: ExportSegment[],
  title: string,
  fps: number
): string {
  const lines: string[] = [
    `TITLE: ${title}`,
    'FCM: NON-DROP FRAME',
    ''
  ];

  let recordOffset = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const duration = seg.end - seg.start;
    const eventNum = String(i + 1).padStart(3, '0');

    const srcIn = secondsToTimecode(seg.start, fps);
    const srcOut = secondsToTimecode(seg.end, fps);
    const recIn = secondsToTimecode(recordOffset, fps);
    const recOut = secondsToTimecode(recordOffset + duration, fps);

    lines.push(`${eventNum}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    recordOffset += duration;
  }

  return lines.join('\n') + '\n';
}

function frameDurationStr(fps: number): string {
  const ntscRates: Record<number, string> = {
    23.976: '1001/24000s',
    29.97: '1001/30000s',
    59.94: '1001/60000s'
  };

  const rounded = Math.round(fps * 100) / 100;
  if (ntscRates[rounded]) return ntscRates[rounded];

  return `1/${Math.round(fps)}s`;
}

function canonicalFpsLabel(fps: number): string {
  const rounded = Math.round(fps * 100) / 100;
  const aliases = new Map<number, string>([
    [23.98, '2398'],
    [23.976, '2398'],
    [24, '24'],
    [25, '25'],
    [29.97, '2997'],
    [30, '30'],
    [50, '50'],
    [59.94, '5994'],
    [60, '60']
  ]);

  return aliases.get(rounded) ?? String(Math.round(fps));
}

function resolveVideoFormatName(width: number, height: number, fps: number): string | null {
  const fpsLabel = canonicalFpsLabel(fps);

  if (width === 1920 && height === 1080) return `FFVideoFormat1080p${fpsLabel}`;
  if (width === 1280 && height === 720) return `FFVideoFormat720p${fpsLabel}`;

  return null;
}

function secondsToFcpTime(seconds: number, fps: number): string {
  const frames = Math.round(seconds * fps);
  const rationalFps = Math.round(fps * 1000);
  return `${frames * 1000}/${rationalFps}s`;
}

export function generateFcpXml(
  segments: ExportSegment[],
  title: string,
  fps: number,
  sourceFilePath: string,
  sourceDuration: number,
  media: FcpMediaInfo
): string {
  const fd = frameDurationStr(fps);
  const fileUrl = pathToFileURL(sourceFilePath).href;
  const escapedTitle = escapeXml(title);
  const escapedFileUrl = escapeXml(fileUrl);
  const srcDurTime = secondsToFcpTime(sourceDuration, fps);
  const formatName = media.hasVideo ? resolveVideoFormatName(media.width, media.height, fps) : null;

  const formatAttrs = media.hasVideo
    ? formatName
      ? `name="${formatName}"`
      : `frameDuration="${fd}" width="${media.width}" height="${media.height}"`
    : `name="FFAudioFormat" frameDuration="${fd}"`;
  const hasVideoAttr = media.hasVideo ? '1' : '0';
  const hasAudioAttr = media.hasAudio ? '1' : '0';
  const assetFormatAttr = media.hasVideo ? ' format="r1"' : '';

  let clipXml = '';
  let offset = 0;

  for (const seg of segments) {
    const duration = seg.end - seg.start;
    const offsetTime = secondsToFcpTime(offset, fps);
    const durationTime = secondsToFcpTime(duration, fps);
    const startTime = secondsToFcpTime(seg.start, fps);

    clipXml += `                        <asset-clip name="${escapedTitle}" ref="r2" offset="${offsetTime}" start="${startTime}" duration="${durationTime}" />\n`;

    offset += duration;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
    <resources>
        <format id="r1" ${formatAttrs} />
        <asset id="r2" name="${escapedTitle}" start="0s" duration="${srcDurTime}" hasVideo="${hasVideoAttr}" hasAudio="${hasAudioAttr}"${assetFormatAttr}>
            <media-rep kind="original-media" src="${escapedFileUrl}" />
        </asset>
    </resources>
    <library>
        <event name="${escapedTitle}">
            <project name="${escapedTitle}">
                <sequence format="r1">
                    <spine>
${clipXml.trimEnd()}
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>
`;
}

export async function writeEditorFile(
  outputPath: string,
  segments: ExportSegment[],
  format: 'edl' | 'fcpxml',
  title: string,
  fps: number,
  sourceFilePath: string,
  sourceDuration: number,
  media?: FcpMediaInfo
): Promise<{ success: boolean; error?: string }> {
  try {
    let content: string | Buffer;

    switch (format) {
      case 'edl':
        content = generateEdl(segments, title, fps);
        break;
      case 'fcpxml':
        content = generateFcpXml(segments, title, fps, sourceFilePath, sourceDuration,
          media ?? { width: 1920, height: 1080, hasVideo: true, hasAudio: true });
        break;
    }

    await writeFile(outputPath, content, typeof content === 'string' ? 'utf-8' : undefined);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
