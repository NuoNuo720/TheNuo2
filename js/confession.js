// 初始化 Supabase（把下面的 URL 和密钥，替换成你自己的）
const supabaseUrl = "https://csrsbqixmzfdlpqokazr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzcnNicWl4bXpmZGxwcW9rYXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjA1NTMsImV4cCI6MjA3NTEzNjU1M30.VC6miCQW-tiNVbYNf8KgkCkZ3wQoy2HDERs1-DTdKEw";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 获取页面元素
const confessionInput = document.getElementById("confessionInput");
const submitBtn = document.getElementById("submitBtn");
const confessionsList = document.getElementById("confessionsList");

// 【功能 1：提交表白】
submitBtn.addEventListener("click", async () => {
  const content = confessionInput.value.trim();
  if (!content) {
    alert("请输入表白内容～");
    return;
  }

  // 禁用按钮，防止重复提交
  submitBtn.disabled = true;
  submitBtn.innerText = "发布中...";

  // 把内容提交到 Supabase 的 confessions 表
  const { error } = await supabase
    .from("confessions") // 表名
    .insert([{ content: content }]); // 插入内容

  if (error) {
    alert("发布失败，请重试～");
    console.error("发布出错：", error);
  } else {
    // 清空输入框
    confessionInput.value = "";
    // 重新加载表白列表（这样新提交的能立即显示）
    loadConfessions();
  }

  // 恢复按钮
  submitBtn.disabled = false;
  submitBtn.innerText = "发布表白";
});

// 【功能 2：加载并显示表白内容】
async function loadConfessions() {
  confessionsList.innerHTML = "加载中...";

  // 从 Supabase 获取 confessions 表的数据（按时间倒序，最新的在最前面）
  const { data, error } = await supabase
    .from("confessions")
    .select("*")
    .order("created_at", { ascending: false }); // 按创建时间倒序

  if (error) {
    confessionsList.innerHTML = "加载失败，请刷新页面～";
    console.error("加载出错：", error);
    return;
  }

  if (data.length === 0) {
    confessionsList.innerHTML = "还没有表白哦，快来成为第一个～";
    return;
  }

  // 遍历数据，生成表白卡片
  confessionsList.innerHTML = "";
  data.forEach((item) => {
    // 格式化时间（比如：2025-10-04 12:30）
    const time = new Date(item.created_at).toLocaleString();
    const confessionItem = document.createElement("div");
    confessionItem.className = "confession-item";
    confessionItem.innerHTML = `
      <p>${item.content}</p>
      <div style="font-size: 12px; color: #999; margin-top: 10px;">
        发布时间：${time}
      </div>
    `;
    confessionsList.appendChild(confessionItem);
  });
}

// 页面加载时，先加载一次表白内容
loadConfessions();