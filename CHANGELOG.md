# 1.3.2-beta.3

- [优化theme]优化packages/core/src/common/styles.ts中mergeAndRealizeTheme方法，在更新cell时，此方法频繁创建新对象({...theme}),存在性能问题

# 1.3.2-beta.4

- [版本升级] 升级版本到6.0.4-alpha25, 旧版本为6.0.4-alpha8
- [markerCell]修改markerCell绘制expand逻辑, 修改icon选中逻辑(通过selected属性控制)
- [getMarkerContent]拓展getMarkerContent函数返回结果，除了node还有行meta信息，主要用于markerCell expand绘制，不再直接修改展开/收起状态
