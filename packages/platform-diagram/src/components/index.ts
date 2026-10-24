// ホーム図の描画コンポーネントのバレル export。
// PlatformDiagram が3層（SVG / 出口・乗換プレート / 対面乗換の札）をまとめた
// 主要エントリ。個別の層も export しておく（admin の編集レイヤが座標系の
// 参照先として直接使う可能性があるため。ADR-0010）。
export { PlatformDiagram } from './PlatformDiagram';
export { DiagramSvg } from './diagram/DiagramSvg';
export { ConcoursePlateRow } from './overlay/ConcoursePlateRow';
export { FacingTransferTagRow } from './overlay/FacingTransferTagRow';
export { VerticalPlateColumn } from './overlay/VerticalPlateColumn';
