/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#08111F",
        card: "#102038",
        accent: "#F4B942",
        secondary: "#40D3F2",
        success: "#5DD39E",
        danger: "#F25F5C",
        muted: "#94A3B8",
      },
      fontFamily: {
        display: ["System"],
        body: ["System"],
      },
    },
  },
  plugins: [],
};
