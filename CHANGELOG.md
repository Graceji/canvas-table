# 1.3.2-beta.3

- [优化theme]优化packages/core/src/common/styles.ts中mergeAndRealizeTheme方法，在更新cell时，此方法频繁创建新对象({...theme}),存在性能问题

# 1.3.2-beta.4

- [版本升级] 升级版本到6.0.4-alpha25, 旧版本为6.0.4-alpha8
- [markerCell]修改markerCell绘制expand逻辑, 修改icon选中逻辑(通过selected属性控制)
- [getMarkerContent]拓展getMarkerContent函数返回结果，除了node还有行meta信息，主要用于markerCell expand绘制，不再直接修改展开/收起状态

# 1.3.2-beta.5

- [边框线] 恢复合计行竖向线绘制
- [mouse事件]升级6.0.4-alpha25版本后,pointerdown会导致mousedown事件不冒泡,点击空区域antd组件无法响应，所以暂时回退pointerdown事件
- [theme]优化theme缓存键算法

# 1.3.2-beta.6

- [cell] focusCell代替autoFocusLocation, 实现自动focus cell功能

# 1.3.2-beta.7

- [overlay] data-grid-overlay-editor组件中，恢复onFinishEditing函数参数调用，将lastValueRef.current替换为tempValue值，主要用于修复cell进入编辑态后，无任何修改也调用onCellEdited事件问题
- [onCellBlur] 增加onCellBlur事件，用于处理cell blur事件. 主要用于可编辑单元格无任何修改时调用

# 1.3.2-beta.8

- [onCellBlur] 增加onCellBlur传参，originValue。方便外部判断两种场景：1. 单元格原本无内容 2. 单元格原本有内容，但无修改

# 1.3.2-beta.9

- [onCellBlur] 增加onCellBlur传参，eventKey。方便外部判断单元格触发blur事件时，当前单元格对应的key

# 1.3.2-beta.10

- [data-grid.render.rings] 修复拖拽过程中高亮框绘制高度错误问题, 缺少 filterHeight

# 1.3.3-beta.0

- [fillHandle] 支持通过 fillHandle.cursor 自定义拖拽填充时的鼠标样式，兼容完整 CSS cursor 声明与图片光标
- [cursor] 放宽网格内部 cursor 类型，支持自定义 cursor 字符串传递
- [stories] 增加 fill handle 自定义图片光标示例，便于验证不同系统下的显示效果

# 1.3.3-beta.1

- [markerCell] 完善 marker-cell functions 类型判断, 无长度时提前结束逻辑
- [cell ring] 恢复选中 cell 高亮框贴边绘制行为，不再使用内嵌绘制

# 1.3.4-beta.0

- [row-span-grouping] 支持单元格合并

# 1.3.4-beta.1

- [row-span-grouping] 修复单元格合并功能导致shift选中回退问题

# 1.3.4-beta.2

- [filter row] 修复开启 row marker/index 列后，filter row 内部列号与业务列号不一致导致的筛选列错位问题；该问题在 `showIndex`/`markerActions` 与 `filterMarker="none"` 同时使用时更容易暴露
- [filter row] 拆分 row marker filter cell 与业务列 filter cell 语义，新增 `getRowMarkerFilterCellContent`，`getFilterCellContent` 统一只接收业务列索引
- [filter row] 修复 filter row 绘制、点击激活、overlay 打开、清除按钮命中、复制/选区导出等路径使用不同列号语义的问题
- [filter row] row marker filter cell 不再默认复用第一业务列 filter cell，未显式提供时回退为不可交互的 loading cell
- [filter clear] 防止 row marker 虚拟列触发清除筛选时向外抛出负数业务列索引
- [test] 增加 row marker 场景下 filter row 业务列索引、row marker filter cell 独立性、复制/选区导出语义的回归测试

# 1.3.4-beta.3

- [selection] 新增 `keepRowSelectionOnCellClick`，支持业务侧在点击已选中行的正文单元格时决定是否保留行选中状态
- [selection] 修复已选中行的可编辑正文单元格在普通点击、Ctrl/Command 点击、Shift 点击下仍会变更行选中结果的问题；命中该场景时会直接保留已选中行，与普通 Table 保持一致
- [selection] row marker 点击仍保持原有 toggle 行为，不受 `keepRowSelectionOnCellClick` 影响
- [test] 增加可编辑单元格普通点击、Ctrl/Command 点击、Shift 点击、不可编辑单元格反选、row marker toggle 的回归测试

# 1.3.4-beta.4

- [header marker] 新增 `onRowMarkerHeaderClicked`，用于单独处理索引列表头点击，避免将 row marker header click 混入业务列 `onHeaderClicked` 语义
- [header marker] 修复开启 `showCopy`、`showSelectAll` 或自定义 `headerMarkerfns` 时，索引列表头功能 icon 点击不触发的问题
- [hover] 恢复 `DataEditor` 对同一 hover 单元格的去重逻辑，修复鼠标在索引列表头同一单元格内移动时，表头 hover 态和 tooltip 反复刷新导致的闪烁问题
- [test] 增加 row marker header click 事件与索引列表头 hover 去重的回归测试

# 1.3.4-beta.5

- [checkbox] 修复半选状态 checkbox hover 时背景被绘制为全选蓝色的问题，半选 hover 下仍保持未选背景，仅绘制内部半选标识
- [theme] 新增 `checkboxIndeterminateInnerSize` 主题变量，支持通过 styles/theme 配置半选内部方块尺寸，不暴露为 CSS 变量
- [docs] 补充 checkbox boolean column 示例与 theme 字段说明
- [test] 增加半选 checkbox hover 绘制与半选内部尺寸配置的回归测试

# 1.3.4-beta.6

- [overlay] 修复冻结列存在且横向滚动时，可编辑单元格部分进入冻结列遮挡区域后打开编辑态，DOM 编辑器覆盖冻结列或文本位置与单元格错位的问题；命中该场景时会滚动到完整展示编辑列，并将 editor target 对齐到冻结区右边界
- [test] 增加冻结列遮挡场景下打开编辑器的滚动与 editor target 定位回归测试

# 1.3.4-beta.7

- [overlay] 优化冻结列遮挡场景下打开编辑器的时序：命中遮挡时先记录 pending editor 并滚动到完整展示位置，等 visible region 和外部滚动回调处理完成后，再用最新 bounds 创建 editor，避免外部滚动回调中 closeEditor 导致需要二次点击
- [test] 增加冻结列遮挡场景下延迟创建 editor 的回归测试，覆盖外部 onVisibleRegionChanged 调用 closeEditor 时仍可一次打开编辑态

# 1.3.4-beta.8

- [overlay] 扩展可编辑单元格部分遮挡场景的 reveal 判断：除左侧冻结列遮挡外，右侧横向可视区裁切、纵向被表头或底部裁切时，也会先滚动到完整展示位置，再延迟创建 editor，避免 overlay 创建在不完整展示的单元格 bounds 上
- [test] 增加右侧横向裁切、顶部纵向裁切场景下延迟创建 editor 的回归测试

# 1.3.4-beta.9

- [custom header] 支持 `customHeaderCell` 的 `onClick` 拦截表头默认点击逻辑，便于自定义表头 checkbox 控制全选、半选和禁用状态
- [custom header] 对齐表头自定义 cell `onClick` 与 `onSelect` 的 `preventDefault(status?)` 语义，支持通过 `preventDefault(false)` 显式放行默认表头逻辑
- [cursor] `drawHeader` 回调新增 `overrideCursor`，并在表头 hover 首次进入时触发局部重绘，支持禁用表头 checkbox 悬浮显示 `not-allowed`
- [test] 增加自定义表头点击拦截、`preventDefault(false)` 和表头 cursor override 回归测试

# 1.3.4-beta.10

- [overlay] 修复可编辑单元格紧贴横向可视区右边界时，因 cell bounds 包含 1px 网格线被误判为右侧裁切，导致 pending editor 在滚动边界重试后放弃、无法进入编辑态的问题；该问题在最后一列 filter cell 贴近视图末尾时更容易暴露
- [overlay] editor reveal 判断增加 scale-aware 边界容差，保留真实遮挡场景下先滚动再创建 editor 的行为，同时允许贴边单元格直接进入编辑态

# 1.3.5-beta.0

- [overlay] 修复筛选项切换导致垂直滚动条出现或可视区域变化时，已打开的 overlay editor 继续使用旧 cell bounds 和累加的 stay-on-screen 偏移，造成筛选项下拉层溢出单元格/滚动区的问题；overlay target 会随 visible region/client size 变化重新裁剪到 scroller 可视内容区

# 1.3.5-beta.1

- [overlay] 修复筛选行、批量编辑等自定义 overlay editor 在可视区裁剪后，wrapper 与编辑器收到的 target 不一致导致的宽高和位置偏移问题；custom editor 现在与 wrapper 共用裁剪后的有效 target
- [test] 增加横向滚动边界裁剪场景下 overlay editor target 的回归测试

# 1.3.5-beta.2

- [filter] 修改filter行clear icon svg
- [filter] 添加filter行clear icon 自定义icon、size 属性

# 1.3.5-beta.3

- [group header] 修复开启一级表头时，鼠标悬浮在一级表头左侧边框附近触发局部重绘，空分组区域被清空导致左侧层级/索引区域出现遮挡的问题
- [overlay] 修复 React 18 自动批处理下，筛选行/批量编辑通过 Tab 连续切换编辑格时 overlay editor 可能被复用，导致下一格带入上一格输入值且后续 Tab 被忽略的问题；每次打开新的 overlay editor 时会创建独立编辑会话并重置内部临时状态
