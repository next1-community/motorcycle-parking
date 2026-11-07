export function drawScene() {
  return `<section class="lottery-scene" role="status" aria-label="正在抽出選位順位">
    <svg viewBox="0 0 480 230" aria-hidden="true">
      <ellipse cx="241" cy="217" rx="156" ry="9" fill="#b1dace"/>
      <g fill="#ffd04a" class="spark"><path d="m87 43 4 13 13 4-13 4-4 13-4-13-13-4 13-4z"/><path d="m386 67 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/></g>
      <g stroke="#223857" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
        <g class="host"><path d="M110 214q1-70 58-70t60 70z" fill="#148d88"/>
        <path d="m151 148 17 30 18-30" fill="white"/>
        <rect x="111" y="49" width="114" height="108" rx="48" fill="#ffdbbc"/>
        <path d="M110 100q-13-63 45-65 57-9 71 45-24 2-40-16-21 27-52 22l-14 26z" fill="#354461"/>
        <path d="M142 107q5-8 11-1m31 0q6-8 12 0m-36 18q10 12 20-1" fill="none"/>
        <g fill="#f49f96" stroke="none"><ellipse cx="139" cy="119" rx="9" ry="5"/><ellipse cx="199" cy="118" rx="9" ry="5"/></g></g>
        <g class="drum"><g fill="#ffdf82"><rect x="264" y="96" width="10" height="65" rx="5" transform="rotate(-17 269 150)"/><rect x="286" y="91" width="10" height="68" rx="5"/><rect x="302" y="97" width="10" height="64" rx="5" transform="rotate(14 307 151)"/></g>
        <path d="m249 140 80 0-9 70q-31 12-62 0z" fill="#ed765c"/><ellipse cx="289" cy="140" rx="40" ry="7" fill="#ffb68d"/><circle cx="289" cy="177" r="18" fill="#fff1b3"/><text x="289" y="184" text-anchor="middle" font-size="20" font-weight="bold" stroke="none" fill="#223857">籤</text></g>
        <g class="pick"><rect x="277" y="100" width="13" height="46" rx="5" fill="#ffe08b"/><path d="M203 164q22-16 51-28l20-9q14-10 18-2 6 7-10 18l-22 9-45 29q-13 5-12-17z" fill="#ffdbbc"/></g>
      </g>
    </svg><h1>正在抽出選位順位</h1></section>`;
}
