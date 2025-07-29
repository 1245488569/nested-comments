<template>
  <div class="component">
    <!-- Vue组件注释 -->
    <h2>{{ title }}</h2>
    <p>{{ content }}</p>
    <!-- 另一个注释 -->
    <div>1111</div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: "测试标题",
      // JS注释
      content: "测试内容"
    };
  }
};
</script>
