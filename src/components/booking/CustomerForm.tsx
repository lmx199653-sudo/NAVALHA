import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepTitle } from "./BookingProgress";

export function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

interface CustomerFormProps {
  name: string;
  setName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  cpf: string;
  setCpf: (cpf: string) => void;
  onSubmit: () => void;
}

export function CustomerForm({
  name,
  setName,
  phone,
  setPhone,
  cpf,
  setCpf,
  onSubmit,
}: CustomerFormProps) {
  return (
    <section className="space-y-4">
      <StepTitle title="Seus dados" hint="Só precisamos do essencial." />
      <form
        className="surface-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            required
            minLength={2}
            className="h-12"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como podemos te chamar?"
          />
        </div>
        <div className="space-y-2">
          <Label>WhatsApp</Label>
          <Input
            required
            minLength={8}
            inputMode="tel"
            className="h-12"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="space-y-2">
          <Label>CPF</Label>
          <Input
            required
            inputMode="numeric"
            className="h-12"
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            placeholder="000.000.000-00"
          />
          <p className="text-xs text-muted-foreground">
            Usamos o CPF só para identificar seu histórico na barbearia.
          </p>
        </div>
        <Button
          className="h-12 w-full text-base"
          disabled={cpf.replace(/\D/g, "").length !== 11}
        >
          Ver resumo
        </Button>
      </form>
    </section>
  );
}
