import { defineConfig } from "vite";

// GitHub Pages のサブパス (https://<user>.github.io/<repo>/) でも動くよう相対パスで出力する
export default defineConfig({
  base: "./",
});
