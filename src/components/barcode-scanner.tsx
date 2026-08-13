import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X, Check, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (result: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onResult }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "barcode-scanner-region";

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Erro ao parar o scanner:", err);
      }
    }
  };

  const startScanner = async () => {
    setError(null);
    setIsDone(false);
    
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(regionId);
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
      };

      setIsScanning(true);

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onResult(decodedText);
          setIsDone(true);
          stopScanner();
          toast.success("Código identificado: " + decodedText);
          setTimeout(() => onOpenChange(false), 800);
        },
        () => {
          // Silenciosamente ignorar erros de "não encontrado" durante a varredura
        }
      );
    } catch (err: any) {
      console.error("Erro ao iniciar o scanner:", err);
      setIsScanning(false);
      if (err.toString().includes("Permission denied")) {
        setError("Acesso à câmera negado. Por favor, permita o acesso nas configurações do seu navegador.");
      } else {
        setError("Não foi possível acessar a câmera. Verifique se outro app está usando a câmera.");
      }
    }
  };

  useEffect(() => {
    if (open) {
      // Pequeno delay para garantir que o elemento DOM está pronto
      const timer = setTimeout(startScanner, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-black border-none">
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
          <div id={regionId} className="w-full h-full" />
          
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
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[250px] h-[150px] border-2 border-primary rounded-lg shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary animate-scan" />
              </div>
              <p className="absolute bottom-10 left-0 w-full text-center text-white text-xs font-medium uppercase tracking-widest drop-shadow-md">
                Posicione o código no centro
              </p>
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
