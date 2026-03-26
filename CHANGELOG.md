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
