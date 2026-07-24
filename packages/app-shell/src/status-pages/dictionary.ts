export type AppShellStatusPagesDictionary = {
  locale: "pt-PT";
  notFound: {
    label: string;
    heading: string;
    description: string;
    backLabel: string;
  };
  error: {
    label: string;
    heading: string;
    description: string;
    retryLabel: string;
    backLabel: string;
  };
};

export const defaultAppShellStatusPagesDictionary: AppShellStatusPagesDictionary = {
  locale: "pt-PT",
  notFound: {
    label: "404",
    heading: "Página não encontrada",
    description: "A página que tentou abrir não existe ou foi movida.",
    backLabel: "Voltar ao início",
  },
  error: {
    label: "Erro",
    heading: "Algo correu mal",
    description:
      "Ocorreu um erro inesperado ao carregar esta página. Pode tentar novamente ou voltar ao início.",
    retryLabel: "Tentar novamente",
    backLabel: "Voltar ao início",
  },
};
