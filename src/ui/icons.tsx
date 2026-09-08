import type { ReactNode, SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }
const Icon = ({ children, size = 24, ...props }: Props & { children: ReactNode }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
export const AlertTriangle = (props: Props) => <Icon {...props}><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v4m0 3h.01" /></Icon>
export const ArrowDownRight = (props: Props) => <Icon {...props}><path d="M7 7 17 17M17 8v9H8" /></Icon>
export const ArrowUpRight = (props: Props) => <Icon {...props}><path d="M7 17 17 7M8 7h9v9" /></Icon>
export const BookOpen = (props: Props) => <Icon {...props}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></Icon>
export const CircleHelp = (props: Props) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3.9 1.7c-1.1.8-1.7 1.3-1.7 2.5m0 3h.01" /></Icon>
export const Clock3 = (props: Props) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
export const Copy = (props: Props) => <Icon {...props}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Icon>
export const Database = (props: Props) => <Icon {...props}><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5m-14 7v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></Icon>
export const LineChart = (props: Props) => <Icon {...props}><path d="M4 19V5m0 14h16" /><path d="m6 15 4-4 3 2 5-6" /></Icon>
export const RotateCcw = (props: Props) => <Icon {...props}><path d="M4 11a8 8 0 1 1 2 5.7" /><path d="M4 5v6h6" /></Icon>
export const Save = (props: Props) => <Icon {...props}><path d="M5 4h12l2 2v14H5V4Z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></Icon>
export const ShieldCheck = (props: Props) => <Icon {...props}><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></Icon>
export const Sparkles = (props: Props) => <Icon {...props}><path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3Zm7 12 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" /></Icon>
export const X = (props: Props) => <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>
