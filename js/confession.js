// 初始化 Supabase
const supabaseUrl = "https://csrsbqixmzfdlpqokazr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzcnNicWl4bXpmZGxwcW9rYXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjA1NTMsImV4cCI6MjA3NTEzNjU1M30.VC6miCQW-tiNVbYNf8KgkCkZ3wQoy2HDERs1-DTdKEw";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 获取页面元素
const confessionInput = document.getElementById("confessionInput");
const submitBtn = document.getElementById("submitBtn");
const confessionsList = document.getElementById("confessionsList");
// 新增：获取类型选择元素（假设你有一个类型选择器）
const typeSelect = document.getElementById("typeSelect"); // 例如：<select id="typeSelect">

// 【功能 1：提交表白】
submitBtn.addEventListener("click", async () => {
  const content = confessionInput.value.trim();
  // 新增：获取选中的类型
  const type = typeSelect.value;
  
  if (!content) {
    alert("请输入表白内容～");
    return;
  }
  
  if (!type) {
    alert("请选择表白类型～");
    return;
  }

  // 禁用按钮，防止重复提交
  submitBtn.disabled = true;
  submitBtn.innerText = "发布中...";

  // 把内容和类型提交到 Supabase 的 confessions 表
  const { error } = await supabase
    .from("confessions")
    .insert([{ content: content, type: type }]); // 新增：添加type字段

  if (error) {
    alert("发布失败，请重试～");
    console.error("发布出错：", error);
  } else {
    // 清空输入框和类型选择
    confessionInput.value = "";
    typeSelect.value = ""; // 新增：清空类型选择
    // 重新加载表白列表
    loadConfessions();
  }

  // 恢复按钮
  submitBtn.disabled = false;
  submitBtn.innerText = "发布表白";
});

// 【功能 2：加载并显示表白内容】
async function loadConfessions() {
  confessionsList.innerHTML = "加载中...";

  // 从 Supabase 获取数据
  const { data, error } = await supabase
    .from("confessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    confessionsList.innerHTML = "加载失败，请刷新页面～";
    console.error("加载出错：", error);
    return;
  }

  if (data.length === 0) {
    confessionsList.innerHTML = "还没有表白哦，快来成为第一个～";
    return;
  }

  // 遍历数据，生成表白卡片（包含类型显示）
  confessionsList.innerHTML = "";
  data.forEach((item) => {
    const time = new Date(item.created_at).toLocaleString();
    const confessionItem = document.createElement("div");
    confessionItem.className = "confession-item";
    // 新增：显示类型信息
    confessionItem.innerHTML = `
      <div style="margin-bottom: 8px;">
        <span style="display: inline-block; padding: 2px 8px; background: #eee; border-radius: 12px; font-size: 12px; margin-right: 8px;">
          ${item.type}
        </span>
      </div>
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
    