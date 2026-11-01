import { ffmpeg } from 'mediaforge';

export async function transcodeToMp4(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await ffmpeg(inputPath)
    .output(outputPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .addOutputOption('-movflags', '+faststart')
    .run();
}

export async function extractThumbnail(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await ffmpeg(inputPath)
    .output(outputPath)
    .addOutputOption('-ss', '00:00:01')
    .addOutputOption('-vframes', '1')
    .run();
}
