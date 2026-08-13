import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, X, Check, RefreshCw, AlertCircle, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Check digit validation for EAN-13, EAN-8, UPC-A
function validateBarcode(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  
  // EAN-13
  if (code.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[12]);
  }
  
  // EAN-8
  if (code.length === 8) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[7]);
  }

  // UPC-A (12 digits)
  if (code.length === 12) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[11]);
  }

  // Fallback for other formats (CODE_128, etc)
  return code.length >= 6;
}

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (result: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onResult }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [diagInfo, setDiagInfo] = useState<any>(null);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const lastResultRef = useRef<{ code: string; count: number }>({ code: "", count: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoDeviceIdRef = useRef<string | null>(null);

  const stopScanner = async () => {
    if (codeReaderRef.current) {
      try {
        setTorchOn(false);
        videoTrackRef.current = null;
        codeReaderRef.current.reset();
        setIsScanning(false);
      } catch (err) {
        console.error("Erro ao parar o scanner:", err);
      }
    }
  };

  const toggleTorch = async () => {
    if (videoTrackRef.current) {
      try {
        const newState = !torchOn;
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newState } as any]
        });
        setTorchOn(newState);
      } catch (err) {
        console.error("Erro ao alternar lanterna:", err);
      }
    }
  };

  const captureDiagnosticFrame = async () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setLastFrame(dataUrl);
    
    // Testar ZXing neste frame específico
    if (codeReaderRef.current) {
      try {
        const result = await codeReaderRef.current.decodeFromImageElement(dataUrl as any);
        if (result) {
          toast.success("ZXing leu o frame: " + result.getText());
          setDiagInfo((prev: any) => ({ ...prev, lastFrameResult: `Sucesso: ${result.getText()} (${result.getBarcodeFormat()})` }));
        }
      } catch (err) {
        setDiagInfo((prev: any) => ({ ...prev, lastFrameResult: "Não identificado no frame estático" }));
      }
    }
  };

  const startScanner = async () => {
    setError(null);
    setIsDone(false);
    lastResultRef.current = { code: "", count: 0 };
    
    try {
      await stopScanner();
      
      if (!codeReaderRef.current) {
        const hints = new Map();
        // Durante diagnóstico, podemos expandir, mas por padrão mantemos os solicitados
        const formats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE
        ];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(DecodeHintType.ASSUME_GS1, true);
        hints.set(DecodeHintType.TRY_HARDER, true);

        codeReaderRef.current = new BrowserMultiFormatReader(hints);
      }

      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();
      
      // Priorizar câmera traseira
      let selectedDeviceId = videoInputDevices[0]?.deviceId;
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('traseira') ||
        device.label.toLowerCase().includes('environment')
      );
      
      if (backCamera) {
        selectedDeviceId = backCamera.deviceId;
      } else if (videoInputDevices.length > 1) {
        // Se não encontrar pelo nome, tenta a última da lista (geralmente a traseira principal)
        selectedDeviceId = videoInputDevices[videoInputDevices.length - 1].deviceId;
      }

      videoDeviceIdRef.current = selectedDeviceId;
      setIsScanning(true);

      // Constraints para alta performance e foco
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      };

      if (videoRef.current) {
        await codeReaderRef.current.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, err) => {
            if (videoRef.current && isScanning && !diagInfo) {
              const video = videoRef.current;
              const stream = video.srcObject as MediaStream;
              const track = stream?.getVideoTracks()[0];
              const settings = track?.getSettings();
              
              setDiagInfo({
                res: `${video.videoWidth}x${video.videoHeight}`,
                label: track?.label || 'N/A',
                facing: settings?.facingMode || 'unknown',
                deviceId: settings?.deviceId?.slice(0, 8) + '...'
              });
            }

            if (result) {
              const decodedText = result.getText();
              
              // Durante diagnóstico ou teste inicial, aceitamos o primeiro frame válido
              // Para uso real, mantemos 2 frames para evitar falsos positivos
              if (decodedText === lastResultRef.current.code) {
                lastResultRef.current.count++;
              } else {
                lastResultRef.current.code = decodedText;
                lastResultRef.current.count = 1;
              }

              // Se estiver em modo diagnóstico, 1 frame basta para o log
              const threshold = diagnosticMode ? 1 : 2;

              if (lastResultRef.current.count >= threshold) {
                if (validateBarcode(decodedText)) {
                  onResult(decodedText);
                  setIsDone(true);
                  stopScanner();
                  toast.success("Código identificado: " + decodedText);
                  setTimeout(() => onOpenChange(false), 800);
                } else {
                  lastResultRef.current = { code: "", count: 0 };
                }
              }
            }
          }
        );

        // Acessar a track para lanterna e capabilities
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          const track = stream.getVideoTracks()[0];
          videoTrackRef.current = track;
          
          try {
            const capabilities = track.getCapabilities() as any;
            setHasTorch(!!capabilities.torch);
            
            // Tentar aplicar foco contínuo se suportado
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
              await track.applyConstraints({
                advanced: [{ focusMode: 'continuous' } as any]
              });
            }
          } catch (e) {
            console.warn("Capabilities não suportadas neste dispositivo", e);
          }
        }
      }

    } catch (err: any) {
      console.error("Erro ao iniciar o scanner ZXing:", err);
      setIsScanning(false);
      if (err.toString().includes("Permission denied")) {
        setError("Acesso à câmera negado. Por favor, permita o acesso nas configurações do seu navegador.");
      } else {
        setError("Não foi possível acessar a câmera. Tente ajustar a iluminação ou fechar outros apps.");
      }
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (open) {
      // Pequeno delay para garantir que o elemento DOM está pronto e o Dialog terminou a transição
      timer = setTimeout(startScanner, 600);
    }

    return () => {
      if (timer) clearTimeout(timer);
      stopScanner();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-black border-none z-[100]">
        <DialogHeader className="p-4 bg-navy text-white flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-lg font-medium flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Leitor de Código
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-2 text-[10px] h-6 px-2 border border-white/20"
              onClick={() => setDiagnosticMode(!diagnosticMode)}
            >
              {diagnosticMode ? "Sair Diag" : "Diag"}
            </Button>
          </DialogTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10" 
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          <video 
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
          />
          
          {!isScanning && !error && !isDone && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white p-6 text-center">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <Camera className="h-10 w-10 opacity-50" />
                <p>Iniciando câmera...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-sm font-medium">{error}</p>
                <Button variant="secondary" onClick={startScanner}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
                </Button>
              </div>
            </div>
          )}

          {isScanning && !isDone && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-[85%] h-[35%] border-2 border-primary rounded-lg shadow-[0_0_0_1000px_rgba(0,0,0,0.5)] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_15px_rgba(200,16,46,0.8)] animate-scan" />
                
                {/* LINHA DE LEITURA visual */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[90%] h-[1px] bg-red-500/50" />
                </div>

                {/* Cantoneiras */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-sm" />
              </div>

              <div className="mt-8 flex flex-col items-center gap-1 text-white text-center">
                <p className="text-sm font-bold uppercase tracking-wider drop-shadow-lg">
                  Posicione o código dentro da área
                </p>
                <p className="text-[10px] opacity-80 uppercase tracking-widest">
                  Mantenha o celular estável
                </p>
              </div>

              {hasTorch && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 pointer-events-auto bg-black/50 border-white/20 text-white hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTorch();
                  }}
                >
                  {torchOn ? <ZapOff className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4" />}
                  {torchOn ? "Desligar Lanterna" : "Ligar Lanterna"}
                </Button>
              )}
            </div>
          )}

          {isDone && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm transition-all animate-in fade-in zoom-in">
              <div className="bg-white rounded-full p-4 shadow-xl">
                <Check className="h-12 w-12 text-emerald-600" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-navy border-t border-white/10 flex-row gap-2 sm:justify-center">
          <p className="text-[10px] text-white/60 text-center w-full uppercase tracking-tighter">
            Compatível com EAN-13, EAN-8, UPC e Code 128
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
