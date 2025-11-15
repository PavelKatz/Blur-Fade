
import React, { useState, useRef, useEffect, useCallback } from 'react';
import EffectButtons from './components/Slider';
import { UploadIcon, ShareIcon, PlusIcon, FaviconIcon } from './components/Icons';

// Объявляем глобальные переменные для TypeScript
declare const StackBlur: any;
declare const FFMPEG: any;

// Определяем поддерживаемый тип MIME для видео и соответствующее расширение файла
const supportedVideoMimeType = MediaRecorder.isTypeSupported('video/mp4') 
    ? 'video/mp4' 
    : 'video/webm';
const outputVideoExtension = supportedVideoMimeType === 'video/mp4' ? 'mp4' : 'webm';


const App: React.FC = () => {
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [blurValue, setBlurValue] = useState<number>(0);
    const [darknessValue, setDarknessValue] = useState<number>(0);
    const [fileName, setFileName] = useState<string>('edited-media.png');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [isFfmpegLoading, setIsFfmpegLoading] = useState<boolean>(true);
    const [ffmpegError, setFfmpegError] = useState<boolean>(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');


    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ffmpegRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;
        const loadFfmpeg = async () => {
            setIsFfmpegLoading(true);
            setFfmpegError(false);
            try {
                // 1. Ожидаем загрузки скрипта FFMPEG и доступности глобальной переменной
                while (typeof FFMPEG === 'undefined') {
                    if (!isMounted) return; // Останавливаемся, если компонент размонтирован
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // 2. Как только скрипт загружен, инициализируем ffmpeg и загружаем его ядро
                const { createFFmpeg } = FFMPEG;
                const ffmpegInstance = createFFmpeg({ log: false });
                
                // Явно указываем URL для загрузки ядра FFmpeg.
                // Важно: версия @ffmpeg/core (0.12.6) должна точно совпадать
                // с версией @ffmpeg/ffmpeg, загружаемой в index.html.
                const coreURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js';
                await ffmpegInstance.load({ coreURL }); 
                
                if (isMounted) {
                    ffmpegRef.current = ffmpegInstance;
                }
            } catch (e) {
                if (isMounted) {
                    console.error("Failed to load ffmpeg or its core components:", e);
                    setFfmpegError(true);
                }
            } finally {
                if (isMounted) {
                    setIsFfmpegLoading(false);
                }
            }
        };

        loadFfmpeg();

        return () => {
            isMounted = false; // Функция очистки для установки флага при размонтировании компонента
        };
    }, []);

    const drawImageOnCanvas = useCallback(() => {
        if (mediaType !== 'image' || !mediaUrl || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = mediaUrl;
        img.onload = () => {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const parent = canvas.parentElement;
            if (!parent) return;

            const parentWidth = parent.clientWidth;
            const parentHeight = parent.clientHeight;
            
            let canvasStyleWidth = parentWidth;
            let canvasStyleHeight = parentWidth / aspectRatio;

            if (canvasStyleHeight > parentHeight) {
                canvasStyleHeight = parentHeight;
                canvasStyleWidth = parentHeight * aspectRatio;
            }

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            canvas.style.width = `${canvasStyleWidth}px`;
            canvas.style.height = `${canvasStyleHeight}px`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.filter = 'none';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (blurValue > 0) {
                StackBlur.canvasRGBA(canvas, 0, 0, canvas.width, canvas.height, blurValue);
            }
            
            if (darknessValue > 0) {
                const gradientStartY = canvas.height / 3;
                const finalOpacity = darknessValue / 200;
                const gradient = ctx.createLinearGradient(0, gradientStartY, 0, canvas.height);
                gradient.addColorStop(0, 'rgba(0,0,0,0)');
                gradient.addColorStop(1, `rgba(0,0,0,${finalOpacity})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, gradientStartY, canvas.width, canvas.height - gradientStartY);
            }
        };
    }, [mediaUrl, mediaType, blurValue, darknessValue]);
    
    useEffect(() => {
        if (mediaType === 'image') {
            drawImageOnCanvas();
            window.addEventListener('resize', drawImageOnCanvas);
        }
        return () => {
            if (mediaType === 'image') {
                window.removeEventListener('resize', drawImageOnCanvas);
            }
        }
    }, [drawImageOnCanvas, mediaType]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (mediaUrl) {
                URL.revokeObjectURL(mediaUrl);
            }
            
            const newUrl = URL.createObjectURL(file);
            setMediaUrl(newUrl);

            if (file.type.startsWith('image/')) {
                setMediaType('image');
                setFileName(`edited-${file.name}`);
            } else if (file.type.startsWith('video/')) {
                setMediaType('video');
                const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');
                setFileName(`edited-${nameWithoutExt}.${outputVideoExtension}`);
            }
            
            setBlurValue(0);
            setDarknessValue(0);
        }
    };
    
    const shareOrDownload = async (blob: Blob, name: string, type: string) => {
        const file = new File([blob], name, { type });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'Edited Media' });
                return; 
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return;
                }
            }
        }

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = name;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 100);
    };

    const processVideoWithFfmpeg = async () => {
        if (!mediaUrl || !ffmpegRef.current) return;

        setIsProcessing(true);
        setProgress(0);
        setProcessingStatus('Processing video...');

        const ffmpeg = ffmpegRef.current;
        const { fetchFile } = FFMPEG;

        try {
            ffmpeg.setProgress(({ ratio }) => {
                setProgress(Math.max(0, ratio * 100));
            });

            const inputFileName = 'inputfile';
            const outputFileName = `output.${outputVideoExtension}`;

            const videoData = await fetchFile(mediaUrl);
            ffmpeg.FS('writeFile', inputFileName, videoData);

            const args = ['-i', inputFileName];
            const videoFilters: string[] = [];

            if (blurValue > 0) {
                const blurRadius = blurValue / 4;
                videoFilters.push(`boxblur=${blurRadius}`);
            }

            if (darknessValue > 0) {
                const darknessOpacity = darknessValue / 200;
                videoFilters.push(`drawbox=y=ih/3:h=ih*2/3:w=iw:color=black@${darknessOpacity}:t=fill`);
            }
            
            if (videoFilters.length > 0) {
                args.push('-vf', videoFilters.join(','));
            }

            args.push('-c:a', 'copy');
            if (outputVideoExtension === 'mp4') {
                args.push('-c:v', 'libx264');
            }
            args.push('-preset', 'ultrafast');
            args.push(outputFileName);

            await ffmpeg.run(...args);

            const data = ffmpeg.FS('readFile', outputFileName);
            
            const blob = new Blob([data.buffer], { type: supportedVideoMimeType });
            await shareOrDownload(blob, fileName, supportedVideoMimeType);

            ffmpeg.FS('unlink', inputFileName);
            ffmpeg.FS('unlink', outputFileName);

        } catch (error) {
            console.error("Error processing video with FFMPEG:", error);
            alert("Sorry, there was an error processing your video.");
        } finally {
            setIsProcessing(false);
            setProgress(0);
        }
    };


    const handleExport = async () => {
        if (mediaType === 'image') {
            if (!canvasRef.current) return;
            canvasRef.current.toBlob(async (blob) => {
                if (blob) {
                    await shareOrDownload(blob, fileName, 'image/png');
                }
            }, 'image/png');
        } else if (mediaType === 'video') {
            await processVideoWithFfmpeg();
        }
    };
    
    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };
    
    const handleNewMediaClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        fileInputRef.current?.click();
    }
    
    const blurOptions = [
        { label: 'Light', value: 30 },
        { label: 'Middle', value: 60 },
        { label: 'Full', value: 100 },
    ];

    const darknessOptions = [
        { label: 'Light', value: 60 },
        { label: 'Middle', value: 140 },
        { label: 'Full', value: 200 },
    ];
    
    const getShareButtonText = () => {
        if (mediaType !== 'video') return 'Share';
        if (isFfmpegLoading) return 'Encoder loading...';
        if (ffmpegError) return 'Encoder Error';
        return 'Share';
    };

    return (
        <div className="h-screen w-screen bg-gray-900 flex flex-col antialiased p-4 pb-12 sm:p-4 gap-4 relative">
            {isProcessing && (
                 <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
                    <p className="text-white text-xl font-semibold mb-4">{processingStatus}</p>
                    <>
                        <div className="w-11/12 max-w-md bg-gray-600 rounded-full h-2.5">
                            <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-white text-lg mt-2">{Math.round(progress)}%</p>
                    </>
                 </div>
            )}
            {!mediaUrl && (
                <header className="flex-shrink-0">
                    <div className="flex items-center justify-center gap-3">
                        <FaviconIcon className="h-8 w-8" />
                        <h1 className="text-xl font-semibold text-gray-200 tracking-tight">
                            Blur & Fade
                        </h1>
                    </div>
                </header>
            )}
            <main className="flex-1 flex items-center justify-center overflow-hidden relative min-h-0">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    className="hidden"
                />
                {!mediaUrl ? (
                    <div className="text-center">
                        <button
                            onClick={triggerFileUpload}
                            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/25 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 inline-flex items-center gap-3"
                        >
                            <UploadIcon className="h-6 w-6" />
                            Upload Photo or Video
                        </button>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {mediaType === 'image' && (
                            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                        )}
                        {mediaType === 'video' && (
                            <div className="relative max-w-full max-h-full flex items-center justify-center">
                                <video
                                    src={mediaUrl}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline 
                                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                                    style={{ filter: `blur(${blurValue / 15}px)`}}
                                />
                                {darknessValue > 0 && (
                                     <div 
                                        className="absolute inset-0 pointer-events-none rounded-2xl"
                                        style={{
                                            background: `linear-gradient(to bottom, transparent 33%, rgba(0,0,0,${darknessValue / 200}))`
                                        }}
                                     />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {mediaUrl && (
                <footer className="flex-shrink-0">
                    <fieldset disabled={isProcessing} className="max-w-4xl mx-auto bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-3 space-y-3 shadow-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EffectButtons
                                label="Blur"
                                value={blurValue}
                                onChange={setBlurValue}
                                options={blurOptions}
                            />
                            <EffectButtons
                                label="Fade"
                                value={darknessValue}
                                onChange={setDarknessValue}
                                options={darknessOptions}
                            />
                        </div>
                        <div className="flex justify-center items-center gap-4 pt-2">
                            <button
                                onClick={handleNewMediaClick}
                                className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/25 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                            >
                               <PlusIcon className="h-5 w-5" /> New Media
                            </button>
                            <button
                                onClick={handleExport}
                                className="bg-indigo-500/50 backdrop-blur-md border border-indigo-400/50 hover:bg-indigo-500/75 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isProcessing || (mediaType === 'video' && (isFfmpegLoading || ffmpegError))}
                            >
                                <ShareIcon className="h-5 w-5" />
                                {getShareButtonText()}
                            </button>
                        </div>
                    </fieldset>
                </footer>
            )}
        </div>
    );
};

export default App;