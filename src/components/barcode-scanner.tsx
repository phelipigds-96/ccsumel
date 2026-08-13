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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const lastResultRef = useRef<{ code: string; count: number }>({ code: "", count: 0 });
  const regionId = "barcode-scanner-region";

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        setTorchOn(false);
        videoTrackRef.current = null;
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
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

  const startScanner = async () => {
    setError(null);
    setIsDone(false);
    lastResultRef.current = { code: "", count: 0 };
    
    try {
      await stopScanner();
      
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(regionId);
      }

      const config = {
        fps: 30,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const boxWidth = Math.floor(viewfinderWidth * 0.85);
          const boxHeight = Math.floor(viewfinderHeight * 0.35);
          return { width: boxWidth, height: boxHeight };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
          facingMode: "environment",
          focusMode: "continuous",
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.ITF,
        ],
      };

      setIsScanning(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          // Multi-frame validation: code must be the same for 3 consecutive frames
          if (decodedText === lastResultRef.current.code) {
            lastResultRef.current.count++;
          } else {
            lastResultRef.current.code = decodedText;
            lastResultRef.current.count = 1;
          }

          if (lastResultRef.current.count >= 3) {
            // Final validation of check digit
            if (validateBarcode(decodedText)) {
              onResult(decodedText);
              setIsDone(true);
              stopScanner();
              toast.success("Código identificado: " + decodedText);
              setTimeout(() => onOpenChange(false), 800);
            } else {
              // Reset if check digit fails
              lastResultRef.current = { code: "", count: 0 };
            }
          }
        },
        () => {
          // Ignore scanning errors
        }
      );

      // Attempt to get the video track for torch support
      setTimeout(() => {
        const videoElement = document.querySelector(`#${regionId} video`) as HTMLVideoElement;
        if (videoElement && videoElement.srcObject instanceof MediaStream) {
          const track = videoElement.srcObject.getVideoTracks()[0];
          if (track) {
            videoTrackRef.current = track;
            const capabilities = track.getCapabilities() as any;
            setHasTorch(!!capabilities.torch);
          }
        }
      }, 1000);

    } catch (err: any) {
      console.error("Erro ao iniciar o scanner:", err);
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

        <div className="relative aspect-square w-full bg-black flex items-center justify-center">
          <div id={regionId} className="w-full h-full [&>video]:object-cover" />
          
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
