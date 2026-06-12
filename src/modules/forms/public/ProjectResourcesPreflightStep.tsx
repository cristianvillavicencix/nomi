import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProjectLinkMode = "new" | "existing";

type ProjectResourcesPreflightStepProps = {
  mode: ProjectLinkMode | null;
  projectCode: string;
  onModeChange: (mode: ProjectLinkMode) => void;
  onProjectCodeChange: (code: string) => void;
  onContinue: () => void;
};

export const ProjectResourcesPreflightStep = ({
  mode,
  projectCode,
  onModeChange,
  onProjectCodeChange,
  onContinue,
}: ProjectResourcesPreflightStepProps) => (
  <section className="space-y-4 rounded-lg border p-4">
    <h2 className="text-base font-semibold">¿Para qué proyecto es esto?</h2>
    <p className="text-sm text-muted-foreground">
      Elegí si este envío es para un proyecto nuevo o uno que ya tenés con nosotros.
    </p>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        variant={mode === "new" ? "default" : "outline"}
        onClick={() => onModeChange("new")}
      >
        Es un proyecto nuevo
      </Button>
      <Button
        type="button"
        variant={mode === "existing" ? "default" : "outline"}
        onClick={() => onModeChange("existing")}
      >
        Ya tengo un proyecto
      </Button>
    </div>
    {mode === "existing" ? (
      <div className="space-y-2">
        <Label htmlFor="project_code">Código de proyecto</Label>
        <Input
          id="project_code"
          value={projectCode}
          placeholder="Ej: 1234"
          onChange={(event) => onProjectCodeChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Usá el ID o código que te compartió nuestro equipo.
        </p>
      </div>
    ) : null}
    <Button
      type="button"
      disabled={!mode || (mode === "existing" && !projectCode.trim())}
      onClick={onContinue}
    >
      Continuar
    </Button>
  </section>
);
