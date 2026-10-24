import type { MetadataRoute } from "next";

// PWA manifest. Icons to be added in a later PWA-polish pass.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Table Plan",
    short_name: "Table Plan",
    description:
      "Your week, decided — a Mon–Fri plan that hits your macros with a Morrisons-priced shopping list.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f2",
    theme_color: "#1f4430",
    lang: "en-GB",
  };
}
