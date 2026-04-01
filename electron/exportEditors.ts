import { writeFile } from 'fs/promises';

interface ExportSegment {
  start: number;
  end: number;
}

export function secondsToTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.round(seconds * fps);
  const f = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
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
    24: '1001/24000s',
    29.97: '1001/30000s',
    30: '1001/30000s',
    59.94: '1001/60000s',
    60: '1001/60000s'
  };

  const rounded = Math.round(fps * 100) / 100;
  return ntscRates[rounded] ?? `100/${Math.round(fps * 100)}s`;
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
  sourceDuration: number
): string {
  const fd = frameDurationStr(fps);
  const fileUrl = `file://${sourceFilePath}`;
  const totalEditDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const totalEditTime = secondsToFcpTime(totalEditDuration, fps);
  const srcDurTime = secondsToFcpTime(sourceDuration, fps);

  let clipXml = '';
  let offset = 0;

  for (const seg of segments) {
    const duration = seg.end - seg.start;
    const offsetTime = secondsToFcpTime(offset, fps);
    const durationTime = secondsToFcpTime(duration, fps);
    const startTime = secondsToFcpTime(seg.start, fps);

    clipXml += `                <clip name="${title}" offset="${offsetTime}" duration="${durationTime}" start="${startTime}" tcFormat="NDF">
                    <video ref="r2" offset="${startTime}" duration="${durationTime}" start="${startTime}" />
                </clip>\n`;

    offset += duration;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
    <resources>
        <format id="r1" name="FFVideoFormat" frameDuration="${fd}" width="1920" height="1080" />
        <asset id="r2" name="${title}" src="${fileUrl}" start="0s" duration="${srcDurTime}" hasVideo="1" hasAudio="1" />
    </resources>
    <library>
        <event name="${title}">
            <project name="${title}">
                <sequence format="r1" duration="${totalEditTime}" tcStart="0s" tcFormat="NDF">
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

export function generateAaf(
  segments: ExportSegment[],
  _title: string,
  _fps: number,
  _sourceFilePath: string
): Buffer {
  throw new Error('AAF export not yet implemented — use EDL or FCP XML instead');
}

export async function writeEditorFile(
  outputPath: string,
  segments: ExportSegment[],
  format: 'edl' | 'fcpxml' | 'aaf',
  title: string,
  fps: number,
  sourceFilePath: string,
  sourceDuration: number
): Promise<{ success: boolean; error?: string }> {
  try {
    let content: string | Buffer;

    switch (format) {
      case 'edl':
        content = generateEdl(segments, title, fps);
        break;
      case 'fcpxml':
        content = generateFcpXml(segments, title, fps, sourceFilePath, sourceDuration);
        break;
      case 'aaf':
        content = generateAaf(segments, title, fps, sourceFilePath);
        break;
    }

    await writeFile(outputPath, content, typeof content === 'string' ? 'utf-8' : undefined);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
