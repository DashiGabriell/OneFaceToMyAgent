import { FACE_PARTS, FACE_PART_ORIGINS } from './parts.ts'
import type { FacePart } from './parts.ts'
import { FACE_VIEWBOX, palette } from './palette.ts'

export interface FaceSvgOptions {
  id?: string
  className?: string
  label?: string
}

const MIRROR_CENTER = FACE_VIEWBOX.width / 2

function mirrorPathData(d: string): string {
  return d.replace(/([MCLZ])([^MCLZ]*)/g, (_match, command: string, body: string) => {
    if (command === 'Z') return command
    const numbers = body.match(/-?\d+(?:\.\d+)?/g)
    if (!numbers) return command
    const mirrored = numbers.map((raw, index) => {
      if (index % 2 !== 0) return raw
      const value = MIRROR_CENTER * 2 - Number(raw)
      return String(Math.round(value * 100) / 100)
    })
    return `${command} ${mirrored.join(' ')}`
  })
}

function part(name: FacePart, markup: string): string {
  return `<g data-part="${name}">${markup}</g>`
}

export function buildFaceSvg(options: FaceSvgOptions = {}): string {
  const id = options.id ?? 'face'
  const className = options.className ?? 'avatar-face'
  const label =
    options.label ??
    'Rosto de homem com boné amarelo dos Lakers, óculos dourados, bigode e cavanhaque'

  const faceD =
    'M 500 416 C 648 416 760 486 792 600 C 814 668 816 736 810 800 C 804 866 790 920 768 968 C 748 1012 728 1038 700 1066 C 666 1104 634 1130 580 1140 C 542 1147 458 1147 420 1140 C 366 1130 334 1104 300 1066 C 272 1038 252 1012 232 968 C 210 920 196 866 190 800 C 184 736 186 668 208 600 C 240 486 352 416 500 416 Z'

  const earOuterL =
    'M 206 606 C 172 586 136 600 124 642 C 114 682 118 748 132 798 C 144 842 172 872 200 862 C 218 855 226 836 222 814 L 217 656 C 217 634 214 618 206 606 Z'
  const earInnerL =
    'M 198 648 C 180 638 164 656 163 690 C 162 726 170 764 184 790 C 193 804 202 800 202 788 L 200 658 C 200 652 200 650 198 648 Z'
  const earFoldL = 'M 192 664 C 178 660 172 678 173 700 C 174 722 180 742 189 758'
  const earOuterR = mirrorPathData(earOuterL)
  const earInnerR = mirrorPathData(earInnerL)
  const earFoldR = mirrorPathData(earFoldL)

  const browL =
    'M 236 638 C 262 612 304 604 350 610 C 390 615 418 628 436 646 C 422 652 406 646 386 640 C 354 630 316 628 288 638 C 270 644 252 650 236 638 Z'
  const browR = mirrorPathData(browL)
  const browTextureOneL = 'M 266 628 C 294 612 328 608 360 616'
  const browTextureTwoL = 'M 290 638 C 316 626 344 624 370 630'
  const browTextureOneR = mirrorPathData(browTextureOneL)
  const browTextureTwoR = mirrorPathData(browTextureTwoL)

  const scleraL =
    'M 292 706 C 302 690 326 682 358 684 C 390 686 412 696 420 706 C 412 720 390 728 358 728 C 326 728 302 722 292 706 Z'
  const upperLidL =
    'M 290 706 C 300 690 326 684 358 684 C 390 686 412 696 420 706 L 426 694 C 418 672 392 664 358 664 C 324 664 298 672 282 694 Z'
  const lowerLidL =
    'M 296 712 C 308 726 330 732 358 732 C 386 732 408 726 422 712 C 410 738 388 748 358 748 C 328 748 306 738 296 712 Z'
  const lashL = 'M 292 706 C 302 692 326 686 358 686 C 390 686 410 694 420 704'
  const lashWingL = 'M 294 702 C 286 698 282 692 280 684'
  const lidCreaseL = 'M 298 696 C 312 682 334 676 358 676 C 382 676 404 682 418 696'
  const lowerLashL = 'M 306 724 C 318 732 336 734 358 734 C 380 734 398 732 410 724'
  const eyeShadeL =
    'M 294 706 C 304 692 326 686 358 688 C 390 690 410 698 418 706 L 418 716 C 410 700 390 692 358 690 C 326 688 306 696 296 714 Z'
  const innerCornerL = 'M 416 704 C 422 702 426 706 424 710 C 422 714 416 714 414 710 Z'
  const scleraR = mirrorPathData(scleraL)
  const upperLidR = mirrorPathData(upperLidL)
  const lowerLidR = mirrorPathData(lowerLidL)
  const lashR = mirrorPathData(lashL)
  const lashWingR = mirrorPathData(lashWingL)
  const lidCreaseR = mirrorPathData(lidCreaseL)
  const lowerLashR = mirrorPathData(lowerLashL)
  const eyeShadeR = mirrorPathData(eyeShadeL)
  const innerCornerR = mirrorPathData(innerCornerL)

  const nostrilL =
    'M 450 846 C 432 846 421 855 425 867 C 429 879 445 884 458 876 C 470 870 472 856 463 849 C 460 846 455 846 450 846 Z'
  const nostrilR = mirrorPathData(nostrilL)

  const mouthCavityD =
    'M 424 960 C 462 948 538 948 576 960 C 566 998 534 1012 500 1012 C 466 1012 434 998 424 960 Z'
  const teethUpperD =
    'M 446 960 C 468 955 532 955 554 960 L 552 976 C 528 980 472 980 448 976 Z'
  const teethLowerD =
    'M 454 998 C 474 994 526 994 546 998 L 544 1008 C 524 1012 476 1012 456 1008 Z'
  const lipUpperD =
    'M 386 956 C 416 930 454 922 482 936 C 492 944 496 942 500 934 C 504 942 508 944 518 936 C 546 922 584 930 614 956 C 588 970 556 966 526 964 C 508 962 492 962 474 964 C 444 966 412 970 386 956 Z'
  const lipLowerD =
    'M 398 964 C 434 960 470 958 500 958 C 530 958 566 960 602 964 C 590 1002 552 1026 500 1026 C 448 1026 410 1002 398 964 Z'

  const neckD =
    'M 440 1120 C 432 1150 424 1175 418 1200 L 582 1200 C 576 1175 568 1150 560 1120 Z'

  const capD =
    'M 500 32 C 578 32 644 52 704 96 C 786 158 830 298 832 466 L 832 502 L 168 502 L 168 466 C 170 298 214 158 296 96 C 356 52 422 32 500 32 Z'
  const capSeamCenter = 'M 500 34 C 498 180 498 340 500 500'
  const capSeamL = 'M 300 98 C 270 210 254 350 252 500'
  const capSeamR = mirrorPathData(capSeamL)
  const capSideShadeL =
    'M 168 500 C 170 314 214 170 296 104 C 252 152 224 250 214 360 C 208 424 208 470 210 500 Z'
  const capSideShadeR = mirrorPathData(capSideShadeL)
  const brimD =
    'M 140 498 C 300 446 700 446 860 498 L 860 514 C 742 556 634 570 500 570 C 366 570 258 556 140 514 Z'
  const brimSeam = 'M 158 516 C 310 556 690 556 842 516'
  const underBrimD =
    'M 150 568 C 300 600 700 600 850 568 C 786 638 650 668 500 668 C 350 668 214 638 150 568 Z'

  const lensPathL =
    'M 214 660 C 254 636 330 630 392 638 C 432 644 458 662 460 696 C 462 742 446 784 416 810 C 388 834 344 840 304 830 C 266 820 236 794 222 756 C 210 724 208 686 214 660 Z'
  const lensPathR = mirrorPathData(lensPathL)
  const bridgeTop = 'M 458 694 C 476 686 524 686 542 694'
  const templeL = 'M 214 666 C 194 654 168 654 146 668'
  const templeR = mirrorPathData(templeL)
  const lensShineL = 'M 246 718 L 300 658 L 326 658 L 266 738 Z'
  const lensShineTwoL = 'M 282 800 L 336 746 L 348 762 L 302 812 Z'
  const lensShineR = mirrorPathData(lensShineL)
  const lensShineTwoR = mirrorPathData(lensShineTwoL)

  const mustacheD =
    'M 380 960 C 400 916 440 900 476 924 C 490 934 496 930 500 916 C 504 930 510 934 524 924 C 560 900 600 916 620 960 C 592 948 566 948 538 962 C 518 972 506 966 500 958 C 494 966 482 972 462 962 C 434 948 408 948 380 960 Z'
  const beardD =
    'M 500 1002 C 532 1002 560 1012 570 1034 C 584 1062 592 1086 580 1114 C 566 1146 536 1162 500 1170 C 464 1162 434 1146 420 1114 C 408 1086 416 1062 430 1034 C 440 1012 468 1002 500 1002 Z'
  const soulPatchD =
    'M 476 1000 C 488 1012 512 1012 524 1000 L 530 1034 C 514 1042 486 1042 470 1034 Z'

  const origins = FACE_PARTS.map(
    (name) => `      #${id} [data-part="${name}"] { transform-origin: ${FACE_PART_ORIGINS[name]}; }`,
  ).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" class="${className}" viewBox="0 0 ${FACE_VIEWBOX.width} ${FACE_VIEWBOX.height}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">
  <title>${label}</title>
  <desc>Ilustração vetorial de uma cabeça masculina negra com boné amarelo dos Lakers, óculos dourados, bigode e cavanhaque, dividida em camadas nomeadas para animação.</desc>
  <defs>
    <radialGradient id="${id}-skin" cx="36%" cy="24%" r="86%">
      <stop offset="0" stop-color="${palette.skin.highlight}"/>
      <stop offset="0.3" stop-color="${palette.skin.light}"/>
      <stop offset="0.58" stop-color="${palette.skin.base}"/>
      <stop offset="0.82" stop-color="${palette.skin.shadow}"/>
      <stop offset="1" stop-color="${palette.skin.deep}"/>
    </radialGradient>
    <linearGradient id="${id}-ear" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${palette.skin.mid}"/>
      <stop offset="0.5" stop-color="${palette.skin.base}"/>
      <stop offset="1" stop-color="${palette.skin.shadow}"/>
    </linearGradient>
    <radialGradient id="${id}-soft-shadow">
      <stop offset="0" stop-color="#2a1408" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#2a1408" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#2a1408" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-soft-light">
      <stop offset="0" stop-color="#ffe3c4" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="#ffe3c4" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffe3c4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-socket">
      <stop offset="0" stop-color="#3a1b0d" stop-opacity="0.55"/>
      <stop offset="0.65" stop-color="#3a1b0d" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#3a1b0d" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-cheek">
      <stop offset="0" stop-color="#b8563a" stop-opacity="0.32"/>
      <stop offset="0.7" stop-color="#b8563a" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#b8563a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-underbrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a1508" stop-opacity="0.48"/>
      <stop offset="0.55" stop-color="#2a1508" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#2a1508" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-cap" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${palette.cap.highlight}"/>
      <stop offset="0.35" stop-color="${palette.cap.light}"/>
      <stop offset="0.62" stop-color="${palette.cap.base}"/>
      <stop offset="0.9" stop-color="${palette.cap.shadow}"/>
      <stop offset="1" stop-color="${palette.cap.deep}"/>
    </linearGradient>
    <linearGradient id="${id}-brim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.brim.light}"/>
      <stop offset="0.45" stop-color="${palette.brim.base}"/>
      <stop offset="1" stop-color="${palette.brim.deep}"/>
    </linearGradient>
    <radialGradient id="${id}-ball" cx="38%" cy="30%" r="75%">
      <stop offset="0" stop-color="#f7a544"/>
      <stop offset="0.55" stop-color="${palette.logo.ball}"/>
      <stop offset="1" stop-color="${palette.logo.ballShadow}"/>
    </radialGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="${palette.glasses.highlight}"/>
      <stop offset="0.35" stop-color="${palette.glasses.light}"/>
      <stop offset="0.65" stop-color="${palette.glasses.base}"/>
      <stop offset="1" stop-color="${palette.glasses.deep}"/>
    </linearGradient>
    <linearGradient id="${id}-lens" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.glasses.lens}" stop-opacity="0.2"/>
      <stop offset="0.55" stop-color="${palette.glasses.lens}" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-beard" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${palette.beard.light}"/>
      <stop offset="0.4" stop-color="${palette.beard.mid}"/>
      <stop offset="0.75" stop-color="${palette.beard.base}"/>
      <stop offset="1" stop-color="${palette.beard.deep}"/>
    </linearGradient>
    <linearGradient id="${id}-brow" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${palette.beard.light}"/>
      <stop offset="1" stop-color="${palette.beard.deep}"/>
    </linearGradient>
    <linearGradient id="${id}-sclera" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7efe3"/>
      <stop offset="0.55" stop-color="${palette.eyes.sclera}"/>
      <stop offset="1" stop-color="${palette.eyes.scleraShadow}"/>
    </linearGradient>
    <radialGradient id="${id}-iris" cx="42%" cy="38%" r="65%">
      <stop offset="0" stop-color="#7a4c26"/>
      <stop offset="0.5" stop-color="${palette.eyes.iris}"/>
      <stop offset="1" stop-color="${palette.eyes.limbal}"/>
    </radialGradient>
    <linearGradient id="${id}-lip-upper" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="${palette.lips.upper}"/>
      <stop offset="1" stop-color="${palette.lips.upperDark}"/>
    </linearGradient>
    <linearGradient id="${id}-lip-lower" x1="0.2" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${palette.lips.lowerLight}"/>
      <stop offset="0.55" stop-color="${palette.lips.lower}"/>
      <stop offset="1" stop-color="#74382b"/>
    </linearGradient>
    <linearGradient id="${id}-teeth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffaf1"/>
      <stop offset="1" stop-color="#ddcfbb"/>
    </linearGradient>
    <radialGradient id="${id}-tongue" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#c06a60"/>
      <stop offset="1" stop-color="#8c4340"/>
    </radialGradient>
    <linearGradient id="${id}-neck" gradientUnits="userSpaceOnUse" x1="0" y1="1120" x2="0" y2="1200">
      <stop offset="0" stop-color="${palette.neck.shadow}" stop-opacity="0.95"/>
      <stop offset="0.35" stop-color="${palette.neck.shadow}" stop-opacity="0.7"/>
      <stop offset="0.65" stop-color="${palette.neck.shadow}" stop-opacity="0.3"/>
      <stop offset="0.9" stop-color="${palette.neck.shadow}" stop-opacity="0"/>
      <stop offset="1" stop-color="${palette.neck.shadow}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="${id}-eye-clip-l"><path d="${scleraL}"/></clipPath>
    <clipPath id="${id}-eye-clip-r"><path d="${scleraR}"/></clipPath>
    <clipPath id="${id}-mouth-clip"><path d="${mouthCavityD}"/></clipPath>
    <clipPath id="${id}-lens-clip-l"><path d="${lensPathL}"/></clipPath>
    <clipPath id="${id}-lens-clip-r"><path d="${lensPathR}"/></clipPath>
    <clipPath id="${id}-ball-clip"><circle cx="500" cy="278" r="100"/></clipPath>
    <clipPath id="${id}-face-clip"><path d="${faceD}"/></clipPath>
  </defs>
  <style>
      #${id} { display: block; width: 100%; height: auto; overflow: visible; }
      #${id} [data-part] { transform-box: fill-box; transform-origin: 50% 50%; }
${origins}
  </style>

  ${part(
    'neck',
    `<path d="${neckD}" fill="url(#${id}-neck)"/>
    <path d="M 436 1110 C 430 1140 422 1170 416 1200" stroke="${palette.neck.shadow}" stroke-width="3" fill="none" opacity="0.2"/>
    <path d="M 564 1110 C 570 1140 578 1170 584 1200" stroke="${palette.neck.shadow}" stroke-width="3" fill="none" opacity="0.2"/>`,
  )}

  <g data-part="head">
    ${part(
      'earL',
      `<path d="${earOuterL}" fill="url(#${id}-ear)"/>
      <path d="${earInnerL}" fill="${palette.skin.shadow}" opacity="0.55"/>
      <ellipse cx="150" cy="822" rx="8" ry="18" fill="${palette.skin.deep}" opacity="0.3"/>
      <ellipse cx="210" cy="700" rx="7" ry="14" fill="${palette.skin.shadow}" opacity="0.4"/>
      <path d="${earFoldL}" stroke="${palette.skin.highlight}" stroke-width="2.5" fill="none" opacity="0.35"/>
      <ellipse cx="184" cy="724" rx="11" ry="26" fill="${palette.skin.shadow}" opacity="0.32"/>
      <ellipse cx="142" cy="670" rx="7" ry="24" fill="${palette.skin.highlight}" opacity="0.14"/>
      <ellipse cx="150" cy="830" rx="6" ry="12" fill="${palette.skin.highlight}" opacity="0.18"/>`,
    )}
    ${part(
      'earR',
      `<path d="${earOuterR}" fill="url(#${id}-ear)"/>
      <path d="${earInnerR}" fill="${palette.skin.shadow}" opacity="0.55"/>
      <ellipse cx="${FACE_VIEWBOX.width - 150}" cy="822" rx="8" ry="18" fill="${palette.skin.deep}" opacity="0.3"/>
      <ellipse cx="${FACE_VIEWBOX.width - 210}" cy="700" rx="7" ry="14" fill="${palette.skin.shadow}" opacity="0.4"/>
      <path d="${earFoldR}" stroke="${palette.skin.highlight}" stroke-width="2.5" fill="none" opacity="0.35"/>
      <ellipse cx="${FACE_VIEWBOX.width - 184}" cy="724" rx="11" ry="26" fill="${palette.skin.shadow}" opacity="0.32"/>
      <ellipse cx="${FACE_VIEWBOX.width - 142}" cy="670" rx="7" ry="24" fill="${palette.skin.highlight}" opacity="0.14"/>
      <ellipse cx="${FACE_VIEWBOX.width - 150}" cy="830" rx="6" ry="12" fill="${palette.skin.highlight}" opacity="0.18"/>`,
    )}

    <path d="${faceD}" fill="url(#${id}-skin)"/>
    <ellipse cx="790" cy="820" rx="66" ry="230" fill="url(#${id}-soft-shadow)" opacity="0.6"/>
    <ellipse cx="210" cy="820" rx="66" ry="230" fill="url(#${id}-soft-shadow)" opacity="0.52"/>
    <ellipse cx="320" cy="748" rx="98" ry="156" fill="url(#${id}-soft-light)" opacity="0.44"/>
    <ellipse cx="680" cy="790" rx="86" ry="150" fill="url(#${id}-soft-shadow)" opacity="0.42"/>
    <ellipse cx="690" cy="744" rx="70" ry="120" fill="url(#${id}-soft-light)" opacity="0.24"/>
    <ellipse cx="700" cy="800" rx="60" ry="40" fill="url(#${id}-soft-light)" opacity="0.2"/>
    <ellipse cx="240" cy="910" rx="64" ry="120" fill="url(#${id}-soft-shadow)" opacity="0.36"/>
    <ellipse cx="760" cy="910" rx="64" ry="120" fill="url(#${id}-soft-shadow)" opacity="0.42"/>
    <ellipse cx="500" cy="846" rx="150" ry="120" fill="url(#${id}-soft-light)" opacity="0.18"/>
    <ellipse cx="500" cy="1004" rx="120" ry="80" fill="url(#${id}-soft-shadow)" opacity="0.24"/>
    <ellipse cx="360" cy="690" rx="112" ry="72" fill="url(#${id}-socket)"/>
    <ellipse cx="640" cy="690" rx="112" ry="72" fill="url(#${id}-socket)"/>
    <path d="M 226 930 C 252 1010 288 1076 340 1118" stroke="${palette.skin.shadow}" stroke-width="10" fill="none" opacity="0.16"/>
    <path d="M 774 930 C 748 1010 712 1076 660 1118" stroke="${palette.skin.shadow}" stroke-width="10" fill="none" opacity="0.2"/>
    <ellipse cx="500" cy="1108" rx="70" ry="24" fill="url(#${id}-soft-light)" opacity="0.2"/>

    ${part('cheekL', `<ellipse cx="300" cy="800" rx="100" ry="66" fill="url(#${id}-cheek)"/>`)}
    ${part(
      'cheekR',
      `<ellipse cx="${FACE_VIEWBOX.width - 300}" cy="800" rx="100" ry="66" fill="url(#${id}-cheek)"/>`,
    )}

    ${part(
      'eyeL',
      `<path d="${scleraL}" fill="url(#${id}-sclera)"/>
      <g clip-path="url(#${id}-eye-clip-l)">
        <path d="${eyeShadeL}" fill="#3f2112" opacity="0.2"/>
        ${part(
          'irisL',
          `<circle cx="358" cy="706" r="22" fill="url(#${id}-iris)"/>
          <circle cx="358" cy="706" r="22" fill="none" stroke="${palette.eyes.limbal}" stroke-width="3" opacity="0.6"/>
          ${part('pupilL', `<circle cx="358" cy="706" r="9" fill="${palette.eyes.pupil}"/>`)}
          <circle cx="351" cy="699" r="4.5" fill="${palette.eyes.highlight}" opacity="0.85"/>
          <circle cx="366" cy="712" r="2.2" fill="${palette.eyes.highlight}" opacity="0.4"/>`,
        )}
      </g>
      <path d="${innerCornerL}" fill="#b8705a" opacity="0.45"/>`,
    )}
    ${part(
      'eyeR',
      `<path d="${scleraR}" fill="url(#${id}-sclera)"/>
      <g clip-path="url(#${id}-eye-clip-r)">
        <path d="${eyeShadeR}" fill="#3f2112" opacity="0.2"/>
        ${part(
          'irisR',
          `<circle cx="642" cy="706" r="22" fill="url(#${id}-iris)"/>
          <circle cx="642" cy="706" r="22" fill="none" stroke="${palette.eyes.limbal}" stroke-width="3" opacity="0.6"/>
          ${part('pupilR', `<circle cx="642" cy="706" r="9" fill="${palette.eyes.pupil}"/>`)}
          <circle cx="649" cy="699" r="4.5" fill="${palette.eyes.highlight}" opacity="0.85"/>
          <circle cx="634" cy="712" r="2.2" fill="${palette.eyes.highlight}" opacity="0.4"/>`,
        )}
      </g>
      <path d="${innerCornerR}" fill="#b8705a" opacity="0.45"/>`,
    )}

    ${part(
      'eyelidUpperL',
      `<path d="${upperLidL}" fill="url(#${id}-skin)"/>
      <path d="${lidCreaseL}" stroke="#6e3f26" stroke-width="3" fill="none" opacity="0.35"/>
      <path d="${lashL}" stroke="#1d110b" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="${lashWingL}" stroke="#1d110b" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.9"/>`,
    )}
    ${part(
      'eyelidUpperR',
      `<path d="${upperLidR}" fill="url(#${id}-skin)"/>
      <path d="${lidCreaseR}" stroke="#6e3f26" stroke-width="3" fill="none" opacity="0.35"/>
      <path d="${lashR}" stroke="#1d110b" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="${lashWingR}" stroke="#1d110b" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.9"/>`,
    )}
    ${part(
      'eyelidLowerL',
      `<path d="${lowerLidL}" fill="url(#${id}-skin)"/>
      <path d="${lowerLashL}" stroke="#4a2818" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.5"/>`,
    )}
    ${part(
      'eyelidLowerR',
      `<path d="${lowerLidR}" fill="url(#${id}-skin)"/>
      <path d="${lowerLashR}" stroke="#4a2818" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.5"/>`,
    )}

    ${part(
      'browL',
      `<path d="${browL}" fill="url(#${id}-brow)"/>
      <path d="${browTextureOneL}" stroke="${palette.beard.sheen}" stroke-width="2" fill="none" opacity="0.35"/>
      <path d="${browTextureTwoL}" stroke="${palette.beard.sheen}" stroke-width="1.6" fill="none" opacity="0.3"/>`,
    )}
    ${part(
      'browR',
      `<path d="${browR}" fill="url(#${id}-brow)"/>
      <path d="${browTextureOneR}" stroke="${palette.beard.sheen}" stroke-width="2" fill="none" opacity="0.35"/>
      <path d="${browTextureTwoR}" stroke="${palette.beard.sheen}" stroke-width="1.6" fill="none" opacity="0.3"/>`,
    )}

    ${part(
      'nose',
      `<path d="M 476 668 C 468 728 460 790 448 834" stroke="${palette.skin.shadow}" stroke-width="5" fill="none" opacity="0.18"/>
      <path d="M 492 690 C 486 746 482 798 486 834" stroke="${palette.skin.highlight}" stroke-width="9" fill="none" opacity="0.18"/>
      <path d="M 520 700 C 532 758 542 806 552 840" stroke="${palette.skin.shadow}" stroke-width="10" fill="none" opacity="0.14"/>
      <ellipse cx="500" cy="844" rx="56" ry="38" fill="url(#${id}-soft-light)" opacity="0.42"/>
      <ellipse cx="500" cy="846" rx="44" ry="26" fill="${palette.skin.base}" opacity="0.35"/>
      <ellipse cx="490" cy="832" rx="22" ry="13" fill="${palette.skin.highlight}" opacity="0.3"/>
      <path d="M 448 822 C 436 838 438 858 456 868" stroke="${palette.skin.shadow}" stroke-width="5" fill="none" opacity="0.3"/>
      <path d="M 552 822 C 564 838 562 858 544 868" stroke="${palette.skin.shadow}" stroke-width="5" fill="none" opacity="0.3"/>
      <ellipse cx="442" cy="846" rx="38" ry="30" fill="url(#${id}-soft-shadow)" opacity="0.5"/>
      <ellipse cx="558" cy="846" rx="38" ry="30" fill="url(#${id}-soft-shadow)" opacity="0.5"/>
      <ellipse cx="500" cy="882" rx="50" ry="11" fill="url(#${id}-soft-shadow)" opacity="0.65"/>
      ${part('nostrilL', `<path d="${nostrilL}" fill="#2e140c" opacity="0.82"/>`)}
      ${part('nostrilR', `<path d="${nostrilR}" fill="#2e140c" opacity="0.82"/>`)}`,
    )}

    ${part(
      'jaw',
      `<ellipse cx="330" cy="968" rx="50" ry="100" fill="url(#${id}-soft-shadow)" opacity="0.42"/>
      <ellipse cx="670" cy="968" rx="50" ry="100" fill="url(#${id}-soft-shadow)" opacity="0.42"/>
      <ellipse cx="500" cy="1018" rx="44" ry="12" fill="url(#${id}-soft-shadow)" opacity="0.28"/>
      <ellipse cx="500" cy="1140" rx="126" ry="28" fill="url(#${id}-soft-shadow)" opacity="0.75"/>`,
    )}

    ${part(
      'mouth',
      `${part('mouthCavity', `<path d="${mouthCavityD}" fill="${palette.lips.cavity}"/>`)}
      <g clip-path="url(#${id}-mouth-clip)">
        ${part('tongue', `<ellipse cx="500" cy="992" rx="30" ry="14" fill="url(#${id}-tongue)"/>`)}
        ${part('teethLower', `<path d="${teethLowerD}" fill="url(#${id}-teeth)"/>`)}
        ${part(
          'teethUpper',
          `<path d="${teethUpperD}" fill="url(#${id}-teeth)"/>
          <path d="M 450 974 C 472 978 528 978 550 974" stroke="#b3a48f" stroke-width="1.5" fill="none" opacity="0.35"/>`,
        )}
      </g>
      ${part(
        'lipUpper',
        `<path d="${lipUpperD}" fill="url(#${id}-lip-upper)"/>
        <path d="M 434 946 C 456 936 476 936 490 944" stroke="#c98a72" stroke-width="2" fill="none" opacity="0.16"/>`,
      )}
      ${part(
        'lipLower',
        `<path d="${lipLowerD}" fill="url(#${id}-lip-lower)"/>
        <ellipse cx="500" cy="998" rx="46" ry="7" fill="#e0a184" opacity="0.2"/>`,
      )}
      <path d="M 398 964 C 440 974 560 974 602 964" stroke="${palette.lips.line}" stroke-width="3.5" fill="none" opacity="0.7"/>`,
    )}

    ${part(
      'cap',
      `<path d="${capD}" fill="url(#${id}-cap)"/>
      <path d="${capSideShadeL}" fill="${palette.cap.deep}" opacity="0.28"/>
      <path d="${capSideShadeR}" fill="${palette.cap.deep}" opacity="0.28"/>
      <path d="${capSeamCenter}" stroke="${palette.cap.deep}" stroke-width="4" fill="none" opacity="0.45"/>
      <path d="${capSeamL}" stroke="${palette.cap.deep}" stroke-width="4" fill="none" opacity="0.4"/>
      <path d="${capSeamR}" stroke="${palette.cap.deep}" stroke-width="4" fill="none" opacity="0.4"/>
      <path d="M 190 470 C 320 500 680 500 810 470" stroke="${palette.cap.deep}" stroke-width="5" fill="none" opacity="0.22"/>
      <circle cx="500" cy="36" r="11" fill="${palette.cap.light}" stroke="${palette.cap.shadow}" stroke-width="2"/>`,
    )}

    ${part(
      'capBrim',
      `<path d="${brimD}" fill="url(#${id}-brim)"/>
      <path d="M 146 500 C 300 452 700 452 854 500" stroke="${palette.brim.deep}" stroke-width="6" fill="none" opacity="0.35"/>
      <path d="${brimSeam}" stroke="${palette.brim.deep}" stroke-width="3" fill="none" opacity="0.3" stroke-dasharray="14 10"/>
      <path d="M 140 512 C 258 548 366 558 500 558 C 634 558 742 548 860 512" stroke="${palette.brim.deep}" stroke-width="4" fill="none" opacity="0.4"/>
      <g clip-path="url(#${id}-face-clip)"><path d="${underBrimD}" fill="url(#${id}-underbrim)"/></g>`,
    )}

    ${part(
      'capLogo',
      `<circle cx="500" cy="278" r="100" fill="url(#${id}-ball)"/>
      <g clip-path="url(#${id}-ball-clip)">
        <path d="M 500 178 C 480 218 480 338 500 378" stroke="${palette.logo.seam}" stroke-width="4.5" fill="none" opacity="0.85"/>
        <path d="M 400 278 C 452 266 548 266 600 278" stroke="${palette.logo.seam}" stroke-width="4.5" fill="none" opacity="0.85"/>
        <path d="M 428 200 C 462 238 538 318 572 356" stroke="${palette.logo.seam}" stroke-width="4.5" fill="none" opacity="0.8"/>
        <path d="M 572 200 C 538 238 462 318 428 356" stroke="${palette.logo.seam}" stroke-width="4.5" fill="none" opacity="0.8"/>
        <ellipse cx="500" cy="358" rx="76" ry="20" fill="${palette.logo.ballShadow}" opacity="0.35"/>
      </g>
      <g transform="rotate(-6 500 313)">
        <text x="500" y="254" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="1.5" fill="${palette.logo.gold}" stroke="${palette.logo.purple}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">LOS ANGELES</text>
        <text x="500" y="358" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="66" font-weight="900" letter-spacing="-1" fill="${palette.logo.purple}" stroke="${palette.logo.white}" stroke-width="9" paint-order="stroke" stroke-linejoin="round">LAKERS</text>
      </g>`,
    )}

    ${part(
      'lensL',
      `<path d="${lensPathL}" fill="url(#${id}-lens)"/>
      <g clip-path="url(#${id}-lens-clip-l)">
        <path d="${lensShineL}" fill="#ffffff" opacity="0.16"/>
        <path d="${lensShineTwoL}" fill="#ffffff" opacity="0.1"/>
        <path d="M 238 780 C 270 808 320 826 364 826" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.2"/>
      </g>`,
    )}
    ${part(
      'lensR',
      `<path d="${lensPathR}" fill="url(#${id}-lens)"/>
      <g clip-path="url(#${id}-lens-clip-r)">
        <path d="${lensShineR}" fill="#ffffff" opacity="0.16"/>
        <path d="${lensShineTwoR}" fill="#ffffff" opacity="0.1"/>
        <path d="M 762 780 C 730 808 680 826 636 826" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.2"/>
      </g>`,
    )}

    ${part(
      'glasses',
      `<path d="${lensPathL}" fill="none" stroke="url(#${id}-gold)" stroke-width="11" stroke-linejoin="round"/>
      <path d="${lensPathR}" fill="none" stroke="url(#${id}-gold)" stroke-width="11" stroke-linejoin="round"/>
      <path d="${bridgeTop}" fill="none" stroke="url(#${id}-gold)" stroke-width="11" stroke-linecap="round"/>
      <path d="${templeL}" fill="none" stroke="url(#${id}-gold)" stroke-width="10" stroke-linecap="round"/>
      <path d="${templeR}" fill="none" stroke="url(#${id}-gold)" stroke-width="10" stroke-linecap="round"/>
      <circle cx="214" cy="666" r="6" fill="${palette.glasses.base}"/>
      <circle cx="786" cy="666" r="6" fill="${palette.glasses.base}"/>`,
    )}

    ${part(
      'mustache',
      `<path d="${mustacheD}" fill="url(#${id}-beard)"/>
      <path d="M 420 946 C 442 936 464 936 482 942" stroke="${palette.beard.sheen}" stroke-width="2" fill="none" opacity="0.35"/>
      <path d="M 518 942 C 536 936 558 936 580 946" stroke="${palette.beard.sheen}" stroke-width="2" fill="none" opacity="0.35"/>
      <path d="M 444 956 C 462 948 482 948 498 952" stroke="${palette.beard.sheen}" stroke-width="1.6" fill="none" opacity="0.28"/>`,
    )}

    ${part(
      'beard',
      `<path d="${soulPatchD}" fill="url(#${id}-beard)"/>
      <path d="${beardD}" fill="url(#${id}-beard)"/>
      <path d="M 466 1046 C 478 1074 486 1100 490 1126" stroke="${palette.beard.sheen}" stroke-width="2.4" fill="none" opacity="0.32"/>
      <path d="M 500 1040 C 500 1072 500 1104 500 1136" stroke="${palette.beard.sheen}" stroke-width="2.4" fill="none" opacity="0.32"/>
      <path d="M 534 1046 C 522 1074 514 1100 510 1126" stroke="${palette.beard.sheen}" stroke-width="2.4" fill="none" opacity="0.32"/>
      <path d="M 450 1058 C 462 1080 470 1098 474 1114" stroke="${palette.beard.sheen}" stroke-width="2" fill="none" opacity="0.24"/>
      <path d="M 550 1058 C 538 1080 530 1098 526 1114" stroke="${palette.beard.sheen}" stroke-width="2" fill="none" opacity="0.24"/>`,
    )}
  </g>
</svg>`
}
