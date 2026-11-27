import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  acrescentar,
  cifrar,
  decifrar,
  ultimaSemana,
  ultimoRegistro,
  vazia,
  type BaseConhecimento,
  type Envelope,
  type Lote,
} from "../src/lib/kb";

const DATA_FILE = resolve(process.cwd(), "content/kb/aprendizados.enc.json");

function loadEnvelope(): Partial<Envelope> | null {
  try {
    const raw = readFileSync(DATA_FILE, "utf8").trim();
    if (!raw) return null;
    return JSON.parse(raw) as Partial<Envelope>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

function loadBase(rawKey: string): { base: BaseConhecimento; sha: string | null } {
  const env = loadEnvelope();
  if (!env || Object.keys(env).length === 0) {
    return { base: vazia(), sha: null };
  }
  const base = decifrar(env, rawKey);
  return { base, sha: typeof env.sha === "string" ? env.sha : null };
}

function usage(): never {
  console.error("Uso:\n  npx tsx scripts/kb.ts status [projeto]\n  npx tsx scripts/kb.ts export [projeto]\n  npx tsx scripts/kb.ts append <lote.json>");
  process.exit(2);
}

function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (!cmd || !["status", "export", "append"].includes(cmd)) {
    usage();
  }

  const rawKey = process.env.KB_KEY?.trim() ?? "";
  if (!rawKey) {
    console.error("Erro: variável de ambiente KB_KEY não definida.");
    process.exit(1);
  }

  if (cmd === "status") {
    const { base, sha } = loadBase(rawKey);
    const projetosFiltrados = arg ? base.projetos.filter((p) => p.id === arg) : base.projetos;
    const projetos = projetosFiltrados.map((p) => ({
      id: p.id,
      entradas: base.entradas.filter((e) => e.projeto === p.id).length,
      ultimaSemana: ultimaSemana(base, p.id),
      ultimoRegistro: ultimoRegistro(base, p.id),
    }));
    console.log(
      JSON.stringify(
        {
          sha,
          atualizadoEm: base.atualizadoEm,
          projetos,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === "export") {
    const { base } = loadBase(rawKey);
    if (arg) {
      const filtered: BaseConhecimento = {
        ...base,
        projetos: base.projetos.filter((p) => p.id === arg),
        entradas: base.entradas.filter((e) => e.projeto === arg),
        semanas: base.semanas.filter((s) => s.projeto === arg),
        top3: base.top3[arg] ? { [arg]: base.top3[arg] } : {},
      };
      console.log(JSON.stringify(filtered, null, 2));
    } else {
      console.log(JSON.stringify(base, null, 2));
    }
    return;
  }

  if (cmd === "append") {
    if (!arg) usage();
    const loteRaw = readFileSync(resolve(process.cwd(), arg), "utf8");
    const lote = JSON.parse(loteRaw) as Lote;
    const { base } = loadBase(rawKey);
    const res = acrescentar(base, lote);
    if (res.erros.length > 0) {
      console.log(JSON.stringify({ ok: false, erros: res.erros }, null, 2));
      process.exit(1);
    }
    const env = cifrar(res.base, rawKey);
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, `${JSON.stringify(env, null, 2)}\n`, "utf8");
    console.log(
      JSON.stringify(
        {
          ok: true,
          sha: env.sha,
          adicionadas: res.adicionadas,
          ignoradas: res.ignoradas,
        },
        null,
        2,
      ),
    );
  }
}

main();
