import { useRef, useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const isImageLogo = (logo?: string | null) =>
  !!logo && (logo.startsWith("data:image") || logo.startsWith("http"));

export const AgencyLogo = ({
  logo,
  name,
  className = "h-10 w-10",
}: { logo?: string | null; name?: string | null; className?: string }) => {
  if (isImageLogo(logo)) {
    return (
      <img
        src={logo as string}
        alt={`Logo ${name || "agence"}`}
        loading="lazy"
        className={`${className} rounded-lg object-contain bg-secondary shrink-0`}
      />
    );
  }
  return (
    <span className={`${className} rounded-lg bg-secondary flex items-center justify-center text-lg shrink-0`}>
      {logo || (name || "A").charAt(0).toUpperCase()}
    </span>
  );
};

const MAX_SIDE = 256;

const fileToResizedDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

interface LogoUploaderProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  name?: string | null;
  label?: string;
}

export const LogoUploader = ({ value, onChange, name, label = "Logo de l'agence" }: LogoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisissez un fichier image"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("Image trop lourde (max 4 Mo)"); return; }
    setBusy(true);
    try {
      onChange(await fileToResizedDataUrl(file));
      toast.success("Logo chargé");
    } catch (e: any) {
      toast.error(e?.message || "Impossible de traiter l'image");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3 flex-wrap">
        <AgencyLogo logo={value} name={name} className="h-14 w-14" />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={label}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          {isImageLogo(value) ? "Changer" : "Téléverser"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(null)}>
            <Trash2 className="h-4 w-4 mr-1" /> Retirer
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">PNG ou JPG, max 4 Mo. Redimensionné automatiquement.</p>
    </div>
  );
};

export default LogoUploader;
