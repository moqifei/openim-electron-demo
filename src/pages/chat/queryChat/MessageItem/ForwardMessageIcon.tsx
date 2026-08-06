import { SVGProps } from "react";

const ForwardMessageIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M4 17h8a5 5 0 0 0 0-10h4" />
    <path d="m12 3 4 4-4 4" />
  </svg>
);

export default ForwardMessageIcon;
