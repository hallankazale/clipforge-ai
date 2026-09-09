declare module 'ffprobe-static' {
  const ffprobeStatic: {
    path: string;
    version: string;
    url: string;
  };

  export default ffprobeStatic;
}

declare module 'ffmpeg-static' {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
