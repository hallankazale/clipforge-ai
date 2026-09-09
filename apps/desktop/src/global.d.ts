export {};

declare global {
  interface Window {
    clipforge?: {
      platform: string;
      selectOutputDirectory: () => Promise<string | null>;
    };
  }
}
