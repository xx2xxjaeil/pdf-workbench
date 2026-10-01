# PDF Workbench

브라우저에서 PDF를 열고 텍스트·표·이미지를 추가한 뒤 새 PDF로 내보내는 문서 편집기입니다. 빈 A4 문서에서도 시작할 수 있습니다. 별도 서버나 AI API 키 없이 파일을 브라우저 안에서 처리합니다.

## 실행

Node.js 20 이상과 npm이 필요합니다.

```bash
npm install
npm run dev
```

터미널에 표시된 로컬 주소로 접속하세요. `예제 열기` 버튼으로 2페이지 PDF 편집을 바로 체험할 수 있습니다.

```bash
npm run check   # Prettier, ESLint, TypeScript, 자동 테스트
npm run build   # 프로덕션 빌드
```

## 현재 가능한 작업

- PDF 가져오기 및 페이지 이동. 25MB 이하, 회전·잘림이 없는 PDF를 지원합니다.
- 텍스트 추가·이동·수정, 글자 크기·굵게·기울임·색상·정렬 설정.
- 표 추가, 행·열 증감, 셀 내용·글자 크기·색상·테두리 색상 설정.
- 5MB 이하 PNG/JPG 이미지 추가, 크기와 위치 변경.
- 실행 취소·다시 실행, 확대·축소, 새 PDF로 내보내기.
- 한국어 글꼴을 PDF 안에 포함하고, 저장 결과를 다시 열어 페이지 수를 검증합니다.

## 중요한 제한

기존 PDF의 글자나 그림 자체를 직접 수정하거나 삭제하지는 않습니다. 원본 페이지 위에 새 요소를 추가하는 방식이며, 겉으로 가려도 원본 내용이 삭제·가림 처리(redaction)되는 것은 아닙니다. 앱에서 새로 추가한 요소는 현재 편집 세션 동안 수정할 수 있지만, 내보낸 PDF를 다시 열면 일반 PDF 콘텐츠가 되어 개별 요소로 재편집할 수 없습니다. 편집 프로젝트 저장 형식은 다음 단계입니다.

현재 조판은 페이지 안에서 요소를 배치하는 수준입니다. 문단이 자동으로 여러 페이지에 이어지는 흐름 조판이나 원본 텍스트 교체는 아직 구현하지 않았습니다. 텍스트·표가 지정한 상자보다 길면 내보내기를 막고 크기를 늘리도록 안내합니다. 한국어 글꼴을 전체 임베딩하므로 출력 PDF 크기는 수 MB까지 늘어날 수 있습니다.

## 구조

`src/features/editor/model`은 요소 정의와 변경 이력을, `src/features/editor/pdf`는 PDF 가져오기·렌더링·내보내기를, `src/features/editor/ui`는 화면을 담당합니다. 모든 요소의 좌표는 페이지 좌측 상단을 원점으로 하는 PDF 포인트 단위입니다. 자세한 설계와 확장 계획은 [architecture notes](docs/architecture.md)에 있습니다.

## 글꼴과 라이선스

Nanum Gothic Regular/Bold는 [Google Fonts](https://github.com/google/fonts/tree/main/ofl/nanumgothic)의 SIL Open Font License 글꼴입니다. 라이선스는 `public/fonts/OFL.txt`에 포함했습니다. PDF.js 워커는 고정한 `pdfjs-dist` 패키지에서 복사했습니다.
