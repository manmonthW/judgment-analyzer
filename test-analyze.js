// 测试分析API的简单脚本
const testText = `【案号】(2024)沪0115民初12345号
【法院】上海市浦东新区人民法院
【案由】服务合同纠纷
【当事人】原告：甲公司；被告：乙公司
【诉请】原告主张被告拖欠服务费100万元及逾期利息
【事实与理由】略
【判决结果】一、被告支付服务费90万元；二、驳回其他诉讼请求。
【法律依据】《民法典》第五百零九条、第五百八十条等。`;

async function testAnalyze() {
  try {
    console.log('🧪 开始测试分析API...');
    
    const response = await fetch('http://localhost:3001/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'lawyer',
        text: testText
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API调用失败:', errorData);
      return;
    }
    
    const result = await response.json();
    console.log('✅ 分析成功!');
    console.log('📊 分析结果:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 在浏览器控制台中运行这个函数
console.log('🚀 运行 testAnalyze() 来测试分析功能'); 