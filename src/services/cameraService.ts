export type CameraFacingMode = 'environment' | 'user';

export interface CameraState {
  isActive: boolean;
  isPaused: boolean;
  facingMode: CameraFacingMode;
  hasPermission: boolean;
  errorMessage?: string;
  videoWidth: number;
  videoHeight: number;
}

export class CameraService {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  private currentFacingMode: CameraFacingMode = 'environment';
  private isPaused: boolean = false;
  private stateChangeListeners: ((state: CameraState) => void)[] = [];

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // Handle tab visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  public onStateChange(listener: (state: CameraState) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  private notifyState(error?: string): void {
    const state: CameraState = {
      isActive: !!this.mediaStream && this.mediaStream.active,
      isPaused: this.isPaused,
      facingMode: this.currentFacingMode,
      hasPermission: !!this.mediaStream,
      errorMessage: error,
      videoWidth: this.videoElement?.videoWidth || 0,
      videoHeight: this.videoElement?.videoHeight || 0,
    };
    for (const listener of this.stateChangeListeners) {
      listener(state);
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.pause();
    } else {
      if (this.mediaStream && this.mediaStream.active) {
        this.resume();
      }
    }
  }

  /**
   * Initialize and start the camera stream.
   */
  public async start(videoElement: HTMLVideoElement, preferredFacing: CameraFacingMode = 'environment'): Promise<void> {
    this.videoElement = videoElement;
    this.currentFacingMode = preferredFacing;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Camera API is not supported in this browser. Please use Chrome/Safari with HTTPS or localhost.';
      this.notifyState(err);
      throw new Error(err);
    }

    // Stop existing stream if running
    this.stop();

    try {
      // First attempt: preferred facing mode with full HD resolution if possible
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: this.currentFacingMode },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
      };

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn('Initial camera constraints failed, attempting fallback constraints:', firstErr);
        // Fallback: any video device
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.setAttribute('playsinline', 'true'); // Required for iOS
      this.videoElement.muted = true;

      await this.videoElement.play();
      this.isPaused = false;
      this.notifyState();
    } catch (err: any) {
      let message = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Please grant camera access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is already in use by another application.';
      }
      this.notifyState(message);
      throw new Error(message);
    }
  }

  /**
   * Pause camera preview and processing.
   */
  public pause(): void {
    this.isPaused = true;
    if (this.videoElement) {
      this.videoElement.pause();
    }
    this.notifyState();
  }

  /**
   * Resume camera preview and processing.
   */
  public resume(): void {
    this.isPaused = false;
    if (this.videoElement) {
      this.videoElement.play().catch(console.error);
    }
    this.notifyState();
  }

  /**
   * Switch between front and rear cameras.
   */
  public async toggleCamera(): Promise<void> {
    if (!this.videoElement) return;
    const nextMode: CameraFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    await this.start(this.videoElement, nextMode);
  }

  /**
   * Stop all camera tracks and clean up resources.
   */
  public stop(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isPaused = false;
    this.notifyState();
  }

  /**
   * Grab the current video frame into a canvas.
   */
  public captureFrame(): HTMLCanvasElement | null {
    if (!this.videoElement || this.isPaused || !this.mediaStream || !this.mediaStream.active) {
      return null;
    }

    const video = this.videoElement;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) return null;

    if (this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
    }

    if (!this.offscreenCtx) return null;

    this.offscreenCtx.drawImage(video, 0, 0, width, height);
    return this.offscreenCanvas;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public destroy(): void {
    this.stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }
}
