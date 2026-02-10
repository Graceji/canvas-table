# 1.3.2-beta.3

-   [优化theme]优化packages/core/src/common/styles.ts中mergeAndRealizeTheme方法，在更新cell时，此方法频繁创建新对象({...theme}),存在性能问题
