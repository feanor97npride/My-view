import encryptedData from "../../content/kb/aprendizados.enc.json";
import { decifrar, vazia, type BaseConhecimento, type Envelope } from "./kb";

export function carregarBase(): {
  base: BaseConhecimento;
  sha: string | null;
  erro: string | null;
} {
  const env = encryptedData as Partial<Envelope>;
  const sha = typeof env?.sha === "string" ? env.sha : null;
  const rawKey = process.env.KB_KEY?.trim() ?? "";

  if (!rawKey) {
    return {
      base: vazia(),
      sha,
      erro: "A variável KB_KEY não está configurada no Vercel.",
    };
  }

  try {
    const base = decifrar(env, rawKey);
    return { base, sha, erro: null };
  } catch {
    return {
      base: vazia(),
      sha,
      erro: "Não foi possível decifrar a base (KB_KEY diferente da usada pela rotina).",
    };
  }
}
