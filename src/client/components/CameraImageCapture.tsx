import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

type CameraImageCaptureProps = {
  onImageChange: (file: File | null) => void;
  disabled?: boolean;
};

export function CameraImageCapture({
  onImageChange,
  disabled = false,
}: CameraImageCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onStopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
  };

  const onStartCamera = async () => {
    if (disabled || isCapturing || isRequestingCamera) {
      return;
    }

    setErrorMessage(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErrorMessage(
        'Camera is not available in this browser. You can still generate a portrait, but it will not use your face photo.'
      );
      onImageChange(null);
      return;
    }

    setIsRequestingCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });

      streamRef.current = stream;

      setIsCapturing(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setErrorMessage(
        'We could not access your camera. You can still generate a portrait, but it will not use your face photo.'
      );
      onImageChange(null);
    } finally {
      setIsRequestingCamera(false);
    }
  };

  const onCapturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    setErrorMessage(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings();

    const width =
      video.videoWidth || settings?.width || (settings?.aspectRatio ? 1280 : 0);
    const height =
      video.videoHeight ||
      settings?.height ||
      (settings?.aspectRatio ? Math.round(1280 / settings.aspectRatio!) : 0);

    if (!width || !height) {
      setErrorMessage(
        'Camera is still initializing. Please wait a moment and try again.'
      );
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      setErrorMessage('Unable to capture from camera. Please try again.');
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setErrorMessage('Failed to capture image. Please try again.');
          onImageChange(null);
          return;
        }

        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });

        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result;
          if (typeof result === 'string') {
            setPreview(result);
          }
        };
        reader.readAsDataURL(file);

        onImageChange(file);
        setIsCapturing(false);
        onStopStream();
      },
      'image/jpeg',
      0.92
    );
  };

  const onRemove = () => {
    setPreview(null);
    setErrorMessage(null);
    onImageChange(null);
  };

  const onRetake = () => {
    setPreview(null);
    onImageChange(null);
    onStartCamera();
  };

  useEffect(() => {
    return () => {
      onStopStream();
    };
  }, []);

  useEffect(() => {
    if (!isCapturing || !videoRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const playPromise = video.play();

    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch((error) => {
        console.error('Error playing camera stream:', error);
        setErrorMessage(
          'There was a problem displaying the camera preview. You can still try taking a photo or continue without a selfie.'
        );
      });
    }

    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [isCapturing]);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900">Take your photo</p>
        <p className="text-xs text-gray-500">
          Use your device camera to take a live selfie. This helps us ensure the
          photo is really you.
        </p>
      </div>

      {errorMessage && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {errorMessage}
        </p>
      )}

      {!preview && !isCapturing && (
        <button
          type="button"
          onClick={onStartCamera}
          disabled={disabled || isRequestingCamera}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera className="h-4 w-4" />
          {isRequestingCamera
            ? 'Opening camera...'
            : 'Open camera and take a selfie'}
        </button>
      )}

      {isCapturing && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-black">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover transform -scale-x-100"
              autoPlay
              playsInline
              muted
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCapturePhoto}
              disabled={disabled}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="h-4 w-4" />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCapturing(false);
                onStopStream();
              }}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {preview && !isCapturing && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img
              src={preview}
              alt="Photo preview"
              className="w-full h-64 object-cover transform -scale-x-100"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-white text-xs">
              <Camera className="h-3 w-3" />
              Your photo
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetake}
              disabled={disabled}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Retake photo
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
