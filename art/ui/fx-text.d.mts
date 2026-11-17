// fx-text.mjs 타입 선언(테스트가 원본 WORDS를 FX_STYLE과 대조할 때 쓴다).

/** 글자 격자(행 문자열, '#' = 속). 크기별 글자표. */
export declare const GLYPHS: Readonly<Record<6 | 8 | 10, Readonly<Record<string, readonly string[]>>>>;

/** 3절 표: fx 이름, 글자, 속 높이(px), 칠(보송 32색 인덱스). */
export declare const WORDS: readonly { fx: string; text: string; size: 6 | 8 | 10; color: number }[];

/** 글자가 아닌 부품 칸(`ting_spark`). */
export declare const PARTS: readonly { id: string; rows: readonly string[]; color: number }[];
