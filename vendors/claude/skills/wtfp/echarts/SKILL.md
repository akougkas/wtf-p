---
name: wtfp-echarts
description: Generate publication-quality charts using Apache ECharts
allowed-tools:
  - Bash
  - Read
  - Write
---

# ECharts Generator Skill

Use this skill to create charts from data for papers, posters, or slides.

## Usage

Generate an HTML file with ECharts configuration.

### Example Template
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
</head>
<body>
    <div id="main" style="width: 800px;height:600px;"></div>
    <script type="text/javascript">
        var myChart = echarts.init(document.getElementById('main'));
        var option = {
            title: { text: 'ECharts Example' },
            tooltip: {},
            xAxis: { data: ["A", "B", "C", "D"] },
            yAxis: {},
            series: [{ name: 'Sales', type: 'bar', data: [5, 20, 36, 10] }]
        };
        myChart.setOption(option);
    </script>
</body>
</html>
```

## Strategy
1.  Receive data and chart requirements.
2.  Generate ECharts configuration object.
3.  Inject into HTML template.
4.  User can open HTML in browser to view/export.
