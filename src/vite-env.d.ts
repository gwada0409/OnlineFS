/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface NavigatorUAData { platform?: string }
interface Navigator { userAgentData?: NavigatorUAData }
