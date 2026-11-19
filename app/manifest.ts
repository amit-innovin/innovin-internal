import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Innovin Internal",
    short_name: "Innovin",
    description: "Simple tools for everyday needs. Built for our team.",
    start_url: "/",
    display: "standalone",
    background_color: "#F1F4FA",
    theme_color: "#F1F4FA",
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
