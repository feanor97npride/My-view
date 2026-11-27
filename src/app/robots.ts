import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/privacidade", "/termos"],
        disallow: ["/api/", "/emails", "/newsletters", "/clickup", "/drive", "/github", "/conhecimento", "/indicadores", "/semana", "/configuracoes"],
      },
    ],
  };
}
