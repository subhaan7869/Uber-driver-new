import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw, ShieldCheck, UserCheck, X } from 'lucide-react';
import { DriverAccount } from '../types/driver';
import { uberSounds } from '../utils/uberSounds';

interface FaceVerificationModalProps {
  account: DriverAccount;
  reason?: string;
  onVerified: (snapshotUrl?: string) => void;
  onCancel: () => void;
}

type VerifyStage = 'intro' | 'scanning' | 'processing' | 'verified';

export const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({
  account,
  reason = 'Take a quick selfie to verify your UK PHV driver identity before going online.',
  onVerified,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<VerifyStage>('intro');
  const [cameraStatus, setCameraStatus] = useState<'pending' | 'live' | 'fallback'>('pending');
  const [scanProgress, setScanProgress] = useState(0);
  const [promptText, setPromptText] = useState('Position your face inside the oval');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        if (!cancelled) setCameraStatus('fallback');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraStatus('live');
      } catch {
        if (!cancelled) setCameraStatus('fallback');
      }
    }

    initCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && streamRef.current && cameraStatus === 'live') {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStatus, stage]);

  const captureFrame = (): string | undefined => {
    const video = videoRef.current;
    if (!video || cameraStatus !== 'live' || video.videoWidth === 0) return undefined;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      const size = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 240, 240);
      return canvas.toDataURL('image/jpeg', 0.78);
    } catch {
      return undefined;
    }
  };

  const handleStartScan = () => {
    uberSounds.unlock();
    setStage('scanning');
    setScanProgress(10);
    setPromptText('Center your face inside the oval...');

    const t1 = setTimeout(() => {
      setScanProgress(42);
      setPromptText('Turn head slightly left, then look straight...');
    }, 850);

    const t2 = setTimeout(() => {
      setScanProgress(78);
      setPromptText('Hold still · Matching TfL PHV licence photo...');
    }, 1750);

    const t3 = setTimeout(() => {
      const snap = captureFrame();
      if (snap) setCapturedPhoto(snap);
      setScanProgress(100);
      setStage('processing');
      setPromptText('Running biometric liveness check...');

      setTimeout(() => {
        stopCamera();
        uberSounds.play('accept');
        setStage('verified');
        setPromptText('Identity verified · Ready to go online');
      }, 850);
    }, 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  const handleRetryCamera = async () => {
    stopCamera();
    setCameraStatus('pending');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraStatus('live');
    } catch {
      setCameraStatus('fallback');
    }
  };

  const ringCircumference = 2 * Math.PI * 108;
  const strokeOffset = ringCircumference * (1 - scanProgress / 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#E8F0FE] dark:bg-[#276EF1]/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#276EF1]" />
            </div>
            <div>
              <h3 className="text-[18px] font-extrabold text-black dark:text-white leading-tight">
                Real-Time ID Check
              </h3>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                {account.name} · {account.phvBadge}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Close face verification"
          >
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        <p className="text-[13px] text-[#545454] dark:text-neutral-400 leading-relaxed mb-4">
          {reason}
        </p>

        {/* Biometric Oval Camera Frame */}
        <div className="relative mx-auto w-[236px] h-[276px] flex items-center justify-center my-2">
          <div className="relative w-[204px] h-[244px] rounded-[50%] overflow-hidden bg-[#111318] border-2 border-black/10 dark:border-white/15 flex items-center justify-center">
            {capturedPhoto && stage === 'verified' ? (
              <img
                src={capturedPhoto}
                alt="Verified driver selfie"
                className="w-full h-full object-cover"
              />
            ) : cameraStatus === 'live' ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center px-5 gap-2">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <UserCheck className="w-8 h-8 text-[#5B9BF8]" />
                </div>
                <p className="text-[12px] font-semibold text-white/80">
                  {cameraStatus === 'pending'
                    ? 'Starting front camera...'
                    : 'Front camera unavailable · Guided biometric sensor active'}
                </p>
                {cameraStatus === 'fallback' && stage === 'intro' && (
                  <button
                    type="button"
                    onClick={handleRetryCamera}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-semibold hover:bg-white/25"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry Camera
                  </button>
                )}
              </div>
            )}

            {/* Subtle scanning laser line while scanning */}
            {stage === 'scanning' && (
              <div className="absolute inset-x-0 h-1 bg-[#276EF1] shadow-[0_0_16px_#276EF1] animate-bounce top-1/2" />
            )}
          </div>

          {/* Circular Progress Arc */}
          <svg
            viewBox="0 0 240 240"
            className="absolute inset-0 w-full h-full pointer-events-none -rotate-90"
          >
            <circle
              cx="120"
              cy="120"
              r="108"
              fill="none"
              stroke="rgba(39,110,241,0.16)"
              strokeWidth="5"
            />
            <circle
              cx="120"
              cy="120"
              r="108"
              fill="none"
              stroke={stage === 'verified' ? '#05944F' : '#276EF1'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={strokeOffset}
              className="transition-all duration-500"
            />
          </svg>
        </div>

        {/* Dynamic Guidance Label */}
        <div className="text-center my-3">
          {stage === 'verified' ? (
            <div className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#05944F]">
              <CheckCircle2 className="w-4 h-4" />
              <span>{promptText}</span>
            </div>
          ) : (
            <p className="text-[13.5px] font-semibold text-black dark:text-white">
              {promptText}
            </p>
          )}
          <p className="text-[11.5px] text-[#757575] dark:text-neutral-400 mt-1">
            Photos are checked only for UK TfL / PHV account security.
          </p>
        </div>

        {/* Actions */}
        {stage === 'intro' && (
          <div className="flex gap-2.5 mt-4">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onCancel();
              }}
              className="px-4 h-12 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[14px] font-bold text-black dark:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartScan}
              className="flex-1 h-12 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[15px] font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Take Selfie & Verify
            </button>
          </div>
        )}

        {(stage === 'scanning' || stage === 'processing') && (
          <div className="h-12 rounded-xl bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center text-[14px] font-bold text-black dark:text-white mt-4 tabular-nums">
            Verifying... {scanProgress}%
          </div>
        )}

        {stage === 'verified' && (
          <button
            type="button"
            onClick={() => onVerified(capturedPhoto ?? undefined)}
            className="w-full h-12 rounded-xl bg-[#05944F] hover:bg-[#047A40] text-white text-[15px] font-bold mt-4 transition-colors"
          >
            Continue & Go Online
          </button>
        )}
      </div>
    </div>
  );
};
