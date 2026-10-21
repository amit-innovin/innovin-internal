import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Innovin Internal",
    short_name: "Innovin",
    description: "Simple tools for everyday needs. Built for our team.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5ECF0",
    theme_color: "#F5ECF0",
    icons: [],
  };
}
