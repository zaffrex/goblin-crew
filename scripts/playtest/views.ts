// `docs/design/ui-detail-checklist.md` 1절 표의 네 화면 크기(#330). 체크리스트를 찍는 도구(`menus.ts`, `cover.ts`)는 이 표 하나를 쓴다.
// M1은 #714에서 667×375 @2 → 640×300 @2로 바뀌었다(#713 뒤 667×375는 1.39배라 1.2배 미만 압축 모양이 안 나온다).
// 표와 문서가 어긋나면 `views.test.ts`가 막는다. 휴대폰(mobile)은 탭으로 누른다.

export type ViewName = 'D1' | 'D4' | 'M3' | 'M1';

export interface ChecklistView {
  name: ViewName;
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
}

export const CHECKLIST_VIEWS: Record<ViewName, ChecklistView> = {
  D1: { name: 'D1', width: 1280, height: 720, dpr: 1, mobile: false },
  D4: { name: 'D4', width: 1920, height: 1080, dpr: 1, mobile: false },
  M3: { name: 'M3', width: 844, height: 390, dpr: 3, mobile: true },
  // CSS 배율 1.11: 1.2배 미만 압축 모양(압축 카드·HUD 이름표 압축)이 실제로 나오는 화면(#714).
  M1: { name: 'M1', width: 640, height: 300, dpr: 2, mobile: true },
};
