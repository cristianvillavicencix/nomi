import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignaturePadProps = {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  className?: string;
  width?: number;
  height?: number;
};

/** Mouse/touch canvas signature → PNG data URL. */
export const SignaturePad = ({
  value,
  onChange,
  disabled = false,
  className,
  width = 480,
  height = 120,
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const startDraw = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (disabled) return;
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const point =
      "touches" in event
        ? event.touches[0]
        : (event as React.MouseEvent<HTMLCanvasElement>);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(point.clientX - rect.left, point.clientY - rect.top);
  };

  const draw = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const point =
      "touches" in event
        ? event.touches[0]
        : (event as React.MouseEvent<HTMLCanvasElement>);
    ctx.lineTo(point.clientX - rect.left, point.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChange("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-label="Signature pad"
        className={cn(
          "w-full rounded-md border bg-white touch-none",
          disabled && "pointer-events-none opacity-60",
          value ? "ring-1 ring-primary/20" : null,
        )}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={clear}
      >
        Clear signature
      </Button>
    </div>
  );
};
