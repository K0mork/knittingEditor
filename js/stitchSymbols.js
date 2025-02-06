export function getStitchSymbol(type) {
  switch (type) {
    case 'knit':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0,850.5 H 850.5 V 0 H 0 Z" />
          <path stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 425.62891,84.37109 V 766.4375" />
        </svg>
      `;
    case 'purl':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 81.375 424.878906 L 770.230469 424.871094"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'left_up_three_one':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 441.378906 L 735.601562 98.964844"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 441.378906 L 398.628906 32.390625"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 98.964844 L 398.460938 441.378906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 712.359375 817.878906 L 115.871094 99.128906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'left_up_two_cross':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 683.121094 794.628906 L 58.125 170.988281"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 426.058594 536.46875 L 170.621094 794.628906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 793.371094 679.128906 L 168.371094 55.484375"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 793.558594 170.46875 L 538.128906 428.628906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 682.558594 55.722656 L 427.128906 313.878906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 313.460938 425.140625 L 59.625 676.128906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'left_up_two_one':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 425.628906 424.878906 L 762.601562 82.464844"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 762.828125 767.628906 L 88.875 82.804688"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'middle_up_three_one':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 424.878906 L 735.601562 82.464844"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 767.628906 L 398.628906 82.804688"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 82.464844 L 398.460938 424.878906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'purl_left_up_two_one':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 425.628906 424.878906 L 762.601562 82.464844"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 762.828125 767.628906 L 88.875 82.804688"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 277.878906 138.378906 L 575.429688 138.371094"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'right_up_three_one':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 479.628906 L 735.601562 137.21875"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 479.628906 L 398.628906 84.226562"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 137.21875 L 398.460938 479.628906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 765.378906 L 735.441406 137.160156"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'right_up_two_cross':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 170.628906 793.128906 L 792.910156 173.558594"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 55.125 680.628906 L 680.121094 56.984375"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 311.921875 423.378906 L 55.125 173.378906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 680.171875 793.128906 L 423.371094 543.128906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 795.671875 680.628906 L 538.878906 430.628906"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 422.171875 310.878906 L 165.371094 60.875"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'right_up_two_one':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 144.378906 767.628906 L 762.578125 82.804688"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 438.101562 438.378906 L 88.875 82.398438"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'slip_stitch':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 90.375 754.878906 L 425.949219 119.011719"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 761.199219 754.878906 L 425.621094 119.011719"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="currentColor" fill-opacity="1" stroke="none" stroke-width="1.5002" stroke-linecap="butt" stroke-linejoin="miter"
            d="M 381.75 95.25 L 468.75 95.25 L 468.75 212.25 L 381.75 212.25 Z"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'twist_stitch':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 595.550781 545.628906 L 599.628906 428.828125 C 598.039062 418.648438 593.960938 386.730469 590.109375 367.71875 C 586.25 348.710938 583.539062 332.410156 576.511719 314.761719 C 569.488281 297.101562 556.789062 276.730469 547.960938 261.789062 C 539.121094 246.859375 534.808594 236.898438 523.480469 225.128906 C 512.148438 213.359375 493.121094 199.550781 479.96875 191.179688 C 466.828125 182.800781 472.039062 184.390625 444.621094 174.878906 C 417.199219 165.371094 356.238281 144.101562 315.449219 134.140625 C 274.660156 124.179688 214.828125 116.710938 199.871094 115.121094" 
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 260.960938 538.878906 C 256.148438 517.769531 251.339844 496.671875 250.328125 476.96875 C 249.308594 457.28125 252.351562 440.398438 254.878906 420.699219 C 257.421875 401 261.21875 378.261719 265.519531 358.800781 C 269.828125 339.339844 272.109375 323.160156 280.71875 303.929688 C 289.339844 284.699219 306.050781 259.621094 317.199219 243.441406 C 328.351562 227.261719 337.460938 216.941406 347.601562 206.859375 C 357.730469 196.78125 362.539062 192.320312 378 182.941406 C 393.449219 173.558594 397.25 164.890625 440.308594 150.589844 C 483.371094 136.28125 601.160156 107.910156 636.378906 139.128906" 
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-opacity="1" stroke-miterlimit="10" d="M 259.871094 522.378906 C 263.039062 542.410156 266.210938 562.449219 272.089844 582.480469 C 277.96875 602.519531 285.660156 623.289062 295.160156 642.589844 C 304.671875 661.890625 320.050781 686.078125 329.101562 698.300781 C 338.148438 710.511719 343.800781 710.761719 349.460938 715.890625 C 355.109375 721.019531 357.371094 724.691406 363.03125 729.078125 C 368.679688 733.480469 376.148438 738.859375 383.390625 742.28125 C 390.628906 745.699219 399 747.898438 406.460938 749.609375 C 413.929688 751.320312 420.710938 753.03125 428.179688 752.539062 C 435.640625 752.050781 443.109375 748.878906 451.25 746.679688 C 459.398438 744.480469 469.800781 742.519531 477.039062 739.351562 C 484.28125 736.171875 489.03125 731.769531 494.691406 727.621094 C 500.339844 723.460938 505.769531 719.070312 510.96875 714.421875 C 516.179688 709.78125 522.058594 704.648438 525.898438 699.761719 C 529.75 694.878906 530.429688 690.96875 534.050781 685.101562 C 537.671875 679.238281 543.550781 670.691406 547.621094 664.578125 C 551.691406 658.46875 555.308594 655.050781 558.480469 648.449219 C 561.648438 641.859375 566.621094 625 566.621094 625 C 569.339844 617.179688 572.050781 609.601562 574.769531 601.539062 C 577.480469 593.480469 580.191406 585.410156 582.910156 576.621094 C 585.621094 567.820312 589.019531 557.070312 591.050781 548.761719 C 593.089844 540.460938 592.410156 537.28125 595.128906 526.769531" 
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'purl_twisst_stitch':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg">
  <path
     fill-rule="evenodd"
     fill="none"
     fill-opacity="1"
     d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z M 0 850.5 "
     id="path1"
     style="fill:none" />
  <path
     fill="none"
     stroke-width="100.01"
     stroke-linecap="butt"
     stroke-linejoin="miter"
     stroke="currentColor"
     stroke-opacity="1"
     stroke-miterlimit="10"
     d="M 603.050781 587.628906 L 607.128906 470.828125 C 605.539062 460.648438 601.460938 428.730469 597.609375 409.71875 C 593.75 390.710938 591.039062 374.410156 584.011719 356.761719 C 576.988281 339.101562 564.289062 318.730469 555.460938 303.789062 C 546.621094 288.859375 542.308594 278.898438 530.980469 267.128906 C 519.648438 255.359375 500.621094 241.550781 487.46875 233.179688 C 474.328125 224.800781 479.539062 226.390625 452.121094 216.878906 C 424.699219 207.371094 363.738281 186.101562 322.949219 176.140625 C 282.160156 166.179688 222.328125 158.710938 207.371094 157.128906 "
     transform="matrix(1, 0, 0, -1, 0, 850.5)"
     id="path2" />
  <path
     fill="none"
     stroke-width="100.01"
     stroke-linecap="butt"
     stroke-linejoin="miter"
     stroke="currentColor"
     stroke-opacity="1"
     stroke-miterlimit="10"
     d="M 268.460938 580.878906 C 263.648438 559.769531 258.839844 538.671875 257.820312 518.96875 C 256.808594 499.28125 259.851562 482.398438 262.378906 462.699219 C 264.921875 443 268.71875 420.261719 273.019531 400.800781 C 277.328125 381.339844 279.609375 365.160156 288.21875 345.929688 C 296.839844 326.699219 313.550781 301.621094 324.699219 285.441406 C 335.851562 269.261719 344.960938 258.941406 355.101562 248.859375 C 365.230469 238.78125 370.039062 234.320312 385.5 224.941406 C 400.949219 215.558594 404.75 206.890625 447.808594 192.589844 C 490.871094 178.28125 608.660156 149.910156 643.878906 139.128906 "
     transform="matrix(1, 0, 0, -1, 0, 850.5)"
     id="path3" />
  <path
     fill="none"
     stroke-width="100.01"
     stroke-linecap="butt"
     stroke-linejoin="miter"
     stroke="currentColor"
     stroke-opacity="1"
     stroke-miterlimit="10"
     d="M 267.371094 565.128906 C 270.539062 585.101562 273.710938 605.070312 279.589844 625.039062 C 285.46875 645.011719 293.160156 665.710938 302.660156 684.949219 C 312.171875 704.191406 327.550781 728.300781 336.601562 740.46875 C 345.648438 752.648438 351.300781 752.898438 356.960938 758.011719 C 362.609375 763.121094 364.871094 766.78125 370.53125 771.160156 C 376.179688 775.539062 383.648438 780.898438 390.890625 784.308594 C 398.128906 787.71875 406.5 789.910156 413.960938 791.621094 C 421.429688 793.320312 428.210938 795.03125 435.679688 794.539062 C 443.140625 794.050781 450.609375 790.890625 458.75 788.699219 C 466.898438 786.5 477.300781 784.558594 484.539062 781.390625 C 491.78125 778.21875 496.53125 773.839844 502.191406 769.699219 C 507.839844 765.558594 513.269531 761.179688 518.46875 756.550781 C 523.679688 751.921875 529.558594 746.808594 533.398438 741.941406 C 537.25 737.058594 537.929688 733.171875 541.550781 727.320312 C 545.171875 721.480469 551.050781 712.949219 555.121094 706.871094 C 559.191406 700.78125 562.808594 697.371094 565.980469 690.789062 C 569.148438 684.21875 574.121094 667.410156 574.121094 667.410156 C 576.839844 659.621094 579.550781 652.070312 582.269531 644.03125 C 584.980469 636 587.691406 627.960938 590.410156 619.191406 C 593.121094 610.421875 596.519531 599.710938 598.550781 591.429688 C 600.589844 583.148438 599.910156 579.980469 602.628906 569.511719 "
     transform="matrix(1, 0, 0, -1, 0, 850.5)"
     id="path4" />
  <path
     fill="none"
     stroke-width="80.012"
     stroke-linecap="butt"
     stroke-linejoin="miter"
     stroke="currentColor"
     stroke-opacity="1"
     stroke-miterlimit="10"
     d="M 183.371094 44.625 L 667.179688 44.625 "
     transform="matrix(1, 0, 0, -1, 0, 850.5)"
     id="path5" />
        </svg>
      `;
    case 'yo':
      return `
        <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
          <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="round" stroke-linejoin="round"
            stroke-opacity="1" stroke-miterlimit="10" d="M 88.125 424.878906 C 88.125 611.269531 239.230469 762.378906 425.621094 762.378906 C 612.019531 762.378906 763.121094 611.269531 763.121094 424.878906 C 763.121094 238.480469 612.019531 87.375 425.621094 87.375 C 239.230469 87.375 88.125 238.480469 88.125 424.878906 Z"
            transform="matrix(1, 0, 0, -1, 0, 850.5)" />
        </svg>
      `;
    case 'erase':
      return `
          <svg viewBox="0 0 24 24" style="width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" fill="#ffffff" stroke="#000" stroke-width="2"/>
          </svg>
      `;
    default:
      return '';
  }
} 