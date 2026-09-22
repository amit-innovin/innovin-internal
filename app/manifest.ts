import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Innovin Internal",
    short_name: "Innovin",
    description: "Simple tools for everyday needs. Built for our team.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#1e2a4a",
    icons: [],
  };
}
