"use client";

// Dev-only living style guide for the design system. Mounted by app-shell when the URL hash is
// #kit (e.g. http://localhost:3000/inicio#kit); never shipped to production. Keep it in sync with
// design-api.md when adding primitives.
import { useRef } from "react";
import { Briefcase01Icon, Clock01Icon, Location06Icon, Route01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarStack, Chip, Eyebrow, HeroCard, IconTile, Panel, PanelHeader, SectionLabel, StatTile } from "./primitives";
import { CountUp, Reveal, StageBars, Stagger, StaggerItem, StepList, Sticker, useConfetti } from "./motion";

export function KitShowcase() {
  const fire = useConfetti();
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <div className="space-y-5 pt-6">
      <HeroCard
        eyebrow="Tu siguiente paso"
        title="Entrevista el jueves en Farmacias Bienestar"
        sticker={
          <Sticker variant="lime" dot>
            <strong>2 días</strong>Jue 12 nov
          </Sticker>
        }
      >
        <p className="mt-3 text-primary-foreground/80">Lleva tu INE y comprobante de domicilio.</p>
        <StageBars className="mt-5 h-16" total={6} current={4} tone="inverse" />
        <div className="mt-5 flex gap-2">
          <Button variant="lime" size="xl" ref={btn} onClick={() => fire({ origin: btn.current })}>
            ¡Ahí estaré!
          </Button>
          <Button variant="white" size="xl">
            Ver
          </Button>
        </div>
      </HeroCard>

      <SectionLabel title="Qué sigue" count={4} action={<Button variant="soft" size="sm">Ver todo</Button>} />
      <Panel>
        <PanelHeader icon={Route01Icon} title="Tu postulación" count={3} action={<Badge variant="lime" size="md">Aprobada</Badge>} />
        <Eyebrow>Etapa 3 de 8</Eyebrow>
        <StageBars className="mt-3" total={8} current={3} />
        <StepList
          className="mt-5"
          current={1}
          steps={[
            { title: "Postulación enviada", body: "Hace 2 días", meta: "lun" },
            { title: "La empresa revisa tu perfil", body: "Suele tardar 1 a 2 días" },
            { title: "Entrevista", body: "Te avisamos por WhatsApp" },
            { title: "¡Contratada!" },
          ]}
        />
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Vacantes cerca" value={<CountUp value={22} from={0} />} hint="a 5 km" icon={Location06Icon} />
        <StatTile tone="violet" label="Ahorro al mes" value={<CountUp value={1080} from={0} prefix="$" />} hint="en gasolina" />
        <StatTile tone="lime" label="Nuevas hoy" value="7" />
        <StatTile tone="white" label="Postulaciones" value="3" icon={Briefcase01Icon} />
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Chip active>Todas</Chip>
          <Chip icon={Clock01Icon} count={4}>Matutino</Chip>
          <Chip active count={2}>Construcción</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>default</Badge>
          <Badge variant="lime">lime</Badge>
          <Badge variant="violet">violet</Badge>
          <Badge variant="soft">soft</Badge>
          <Badge variant="status" size="md">En revisión</Badge>
          <Badge variant="status" size="md" style={{ "--dot": "var(--nopal)" } as React.CSSProperties}>
            Vista
          </Badge>
          <Badge variant="status" size="lg" style={{ "--dot": "var(--chile)" } as React.CSSProperties}>
            Urgente
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg">Violet</Button>
          <Button variant="lime" size="lg">Lime</Button>
          <Button variant="soft" size="lg">Soft</Button>
          <Button variant="white" size="lg">White</Button>
          <Button variant="outline" size="lg">Outline</Button>
          <Button variant="ghost" size="lg">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex items-center gap-3">
          <IconTile icon={StarIcon} />
          <IconTile icon={StarIcon} tone="violet" />
          <IconTile icon={StarIcon} tone="lime" />
          <IconTile icon={StarIcon} tone="white" size="sm" />
          <AvatarStack names={["Ana López", "Beto Ruiz", "Caro Díaz", "Dani Gil", "Eva Sol"]} />
        </div>
        <Progress value={60} />
        <Progress value={35} variant="spectrum" />
        <div className="flex gap-4 rounded-tile bg-primary p-4">
          <Progress value={70} variant="lime" className="bg-white/20" />
          <Sticker variant="ink" size="sm" rotate={8}>
            <strong>5</strong>km
          </Sticker>
          <Sticker variant="violet" size="sm" rotate={-6} dot>
            ¡Nuevo!
          </Sticker>
          <Sticker variant="white" size="sm" rotate={12}>
            Sin CV
          </Sticker>
        </div>
      </Panel>

      <Card>
        <CardHeader>
          <CardTitle>shadcn Card</CardTitle>
          <CardDescription>White, big radius, hairline, soft shadow.</CardDescription>
        </CardHeader>
        <CardContent>
          <Stagger as="ul" className="space-y-2">
            {["Uno", "Dos", "Tres"].map((t) => (
              <StaggerItem as="li" key={t} className="rounded-tile bg-tile p-3">
                {t}
              </StaggerItem>
            ))}
          </Stagger>
        </CardContent>
      </Card>
      <Reveal inView className="rounded-panel bg-limon p-6 text-ink">
        <h2 className="font-display text-3xl font-extrabold">Reveal inView</h2>
      </Reveal>
    </div>
  );
}
