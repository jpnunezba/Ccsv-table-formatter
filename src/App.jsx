import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Upload, Download, Eye, Settings, FileText, GripVertical, FileSpreadsheet } from 'lucide-react'
import './App.css'

function App() {
  const [csvData, setCsvData] = useState(null)
  const [headers, setHeaders] = useState([])
  const [selectedColumns, setSelectedColumns] = useState([])
  const [columnRenames, setColumnRenames] = useState({})
  const [tableData, setTableData] = useState([])
  const [fileName, setFileName] = useState('')

  // Define column priority order
  const priorityColumns = [
    'Suburb',
    'State', 
    'Owner Occupier',
    'Vacancy Rate',
    'Growth (12MTHS)',
    '5-Year Sale Price Growth',
    '10-Year Sale Price Growth',
    'DOM',
    'Median Weekly Rent',
    'Suburb $ Median',
    'Rental Yield'
  ]

  // Define percentage fields (shown as decimals in CSV)
  const percentageFields = [
    'Growth (12MTHS)',
    'Growth (10Y Ave)',
    'Rental Yield',
    'Vacancy Rate',
    'Owner Occupier',
    'Social Housing',
    'Market Absorption',
    'IQR % Median',
    'Build. Approvals',
    'Pop. Growth (5Y)',
    'SA2 1-Year Population Growth',
    'SA2 3-Year Population Growth',
    'SA2 5-Year Population Growth',
    'SA2 10-Year Population Growth',
    'SA3 1-Year Population Growth',
    'SA3 3-Year Population Growth',
    'SA3 5-Year Population Growth',
    'SA3 10-Year Population Growth',
    '3-Year Median Sale Price CAGR',
    '5-Year Median Sale Price CAGR',
    '10-Year Median Sale Price CAGR',
    '3-Year Sale Price Growth',
    '5-Year Sale Price Growth',
    '10-Year Sale Price Growth',
    '12-Month Sale Price Growth'
  ]

  // Define currency fields
  const currencyFields = [
    'Suburb $ Median',
    'Median Income',
    'Median Weekly Rent'
  ]

  // Define number fields (formatted with comma separators)
  const numberFields = [
    'Population',
    'Property Count',
    'Total Property Count',
    'SA2 Estimated Resident Population',
    'Sales Volume',
    'Build. Approvals'
  ]

  // Calculate Median Weekly Rent from annual rental yield and property price
  const calculateMedianWeeklyRent = (row) => {
    const propertyPrice = parseFloat(row['Suburb $ Median']) || 0
    const rentalYield = parseFloat(row['Rental Yield']) || 0
    
    if (propertyPrice > 0 && rentalYield > 0) {
      const annualRent = propertyPrice * rentalYield
      const weeklyRent = annualRent / 52
      return Math.round(weeklyRent)
    }
    return 0
  }

  // Format value based on field type
  const formatValue = (value, fieldName) => {
    if (!value || value === '') return ''
    
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return value

    if (percentageFields.includes(fieldName)) {
      return `${(numValue * 100).toFixed(2)}%`
    }
    
    if (currencyFields.includes(fieldName)) {
      if (fieldName === 'Median Weekly Rent') {
        return `$${numValue.toLocaleString()}`
      }
      return `$${numValue.toLocaleString()}`
    }
    
    if (numberFields.includes(fieldName)) {
      return numValue.toLocaleString()
    }
    
    return value
  }

  // Get raw value for Excel export (without formatting)
  const getRawValue = (value, fieldName, originalColumn) => {
    if (!value || value === '') return ''
    
    // For calculated fields like Median Weekly Rent, extract the numeric value from formatted string
    if (originalColumn === 'Median Weekly Rent') {
      // Remove $ sign and commas (e.g., "$871" -> 871)
      const currencyStr = value.toString().replace(/[$,]/g, '')
      const currencyNum = parseFloat(currencyStr)
      return isNaN(currencyNum) ? 0 : currencyNum
    }
    
    // For percentage fields, extract the number and convert to decimal
    if (percentageFields.includes(originalColumn)) {
      // Remove % sign and convert to decimal (e.g., "83.20%" -> 0.8320)
      const percentStr = value.toString().replace('%', '')
      const percentNum = parseFloat(percentStr)
      return isNaN(percentNum) ? 0 : percentNum / 100
    }
    
    // For currency fields, extract the number
    if (currencyFields.includes(originalColumn)) {
      // Remove $ sign and commas (e.g., "$675,000" -> 675000)
      const currencyStr = value.toString().replace(/[$,]/g, '')
      const currencyNum = parseFloat(currencyStr)
      return isNaN(currencyNum) ? 0 : currencyNum
    }
    
    // For number fields, extract the number
    if (numberFields.includes(originalColumn)) {
      // Remove commas (e.g., "15,000" -> 15000)
      const numberStr = value.toString().replace(/,/g, '')
      const numberNum = parseFloat(numberStr)
      return isNaN(numberNum) ? 0 : numberNum
    }
    
    // For other fields, try to parse as number, otherwise return as string
    const numValue = parseFloat(value)
    return isNaN(numValue) ? value : numValue
  }

  // Sort headers with priority columns first
  const sortHeaders = (headers) => {
    const prioritySet = new Set(priorityColumns)
    const priority = headers.filter(h => prioritySet.has(h))
    const others = headers.filter(h => !prioritySet.has(h))
    
    // Sort priority columns according to priorityColumns order
    const sortedPriority = priorityColumns.filter(col => priority.includes(col))
    
    return [...sortedPriority, ...others.sort()]
  }

  const handleFileUpload = useCallback((file) => {
    if (!file) {
      // Reset state when no file
      setCsvData(null)
      setHeaders([])
      setSelectedColumns([])
      setColumnRenames({})
      setTableData([])
      setFileName('')
      return
    }
    
    setFileName(file.name)
    
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        // Add calculated Median Weekly Rent to each row
        const dataWithCalculatedFields = results.data.map(row => ({
          ...row,
          'Median Weekly Rent': calculateMedianWeeklyRent(row)
        }))
        
        setCsvData(dataWithCalculatedFields)
        
        // Get headers and add calculated field
        const csvHeaders = Object.keys(results.data[0] || {})
        const allHeaders = [...csvHeaders, 'Median Weekly Rent']
        const sortedHeaders = sortHeaders(allHeaders)
        
        setHeaders(sortedHeaders)
        
        // Set default selection to only priority columns that exist in the data
        const defaultSelectedColumns = priorityColumns.filter(col => sortedHeaders.includes(col))
        setSelectedColumns(defaultSelectedColumns)
        
        // Initialize column renames with original names
        const initialRenames = {}
        sortedHeaders.forEach(header => {
          initialRenames[header] = header
        })
        setColumnRenames(initialRenames)
        
        generateTableData(dataWithCalculatedFields, defaultSelectedColumns, initialRenames)
      },
      error: (error) => {
        console.error('Error parsing CSV:', error)
      }
    })
  }, [])

  const generateTableData = (data, columns, renames) => {
    const filteredData = data.map(row => {
      const filteredRow = {}
      columns.forEach(col => {
        if (row[col] !== undefined) {
          const renamedCol = renames[col] || col
          const rawValue = col === 'Median Weekly Rent' ? row[col] : row[col]
          filteredRow[renamedCol] = formatValue(rawValue, col)
        }
      })
      return filteredRow
    })
    setTableData(filteredData)
  }

  const handleColumnToggle = (column) => {
    const newSelectedColumns = selectedColumns.includes(column)
      ? selectedColumns.filter(col => col !== column)
      : [...selectedColumns, column]
    
    setSelectedColumns(newSelectedColumns)
    generateTableData(csvData, newSelectedColumns, columnRenames)
  }

  const handleColumnRename = (originalName, newName) => {
    const newRenames = { ...columnRenames, [originalName]: newName }
    setColumnRenames(newRenames)
    generateTableData(csvData, selectedColumns, newRenames)
  }

  // Handle drag end for reordering selected columns
  const handleDragEnd = (result) => {
    if (!result.destination) return

    const items = Array.from(selectedColumns)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setSelectedColumns(items)
    generateTableData(csvData, items, columnRenames)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.classList.add('dragover')
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('dragover')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('dragover')
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const exportTableHTML = () => {
    if (tableData.length === 0) return

    const tableHeaders = Object.keys(tableData[0])
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Report Table</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        .brand-table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        .brand-table th {
            background-color: #2C5F7C;
            color: white;
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
        }
        .brand-table td {
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
        }
        .brand-table tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .brand-table tr:hover {
            background-color: #f3f4f6;
        }
    </style>
</head>
<body>
    <table class="brand-table">
        <thead>
            <tr>
                ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${tableData.map(row => 
                `<tr>${tableHeaders.map(header => `<td>${row[header] || ''}</td>`).join('')}</tr>`
            ).join('')}
        </tbody>
    </table>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'formatted-table.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportTableExcel = () => {
    if (tableData.length === 0) return

    // Create a new workbook
    const wb = XLSX.utils.book_new()
    
    // Get the column headers (renamed columns)
    const tableHeaders = Object.keys(tableData[0])
    
    // Create the data array with headers
    const excelData = []
    
    // Add headers
    excelData.push(tableHeaders)
    
    // Add data rows with raw values for proper Excel formatting
    tableData.forEach(row => {
      const rowData = tableHeaders.map(header => {
        // Find the original column name
        const originalColumn = Object.keys(columnRenames).find(key => columnRenames[key] === header) || header
        const rawValue = getRawValue(row[header], header, originalColumn)
        return rawValue
      })
      excelData.push(rowData)
    })
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(excelData)
    
    // Set column widths
    const colWidths = tableHeaders.map(header => ({ wch: Math.max(header.length, 15) }))
    ws['!cols'] = colWidths
    
    // Style the header row
    const headerRange = XLSX.utils.decode_range(ws['!ref'])
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      
      ws[cellAddress].s = {
        fill: { fgColor: { rgb: "2C5F7C" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: "left" }
      }
    }
    
    // Format percentage columns
    for (let row = 1; row <= headerRange.e.r; row++) {
      for (let col = 0; col < tableHeaders.length; col++) {
        const header = tableHeaders[col]
        const originalColumn = Object.keys(columnRenames).find(key => columnRenames[key] === header) || header
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        
        if (!ws[cellAddress]) continue
        
        // Format percentage fields
        if (percentageFields.includes(originalColumn)) {
          ws[cellAddress].z = '0.00%'
        }
        // Format currency fields
        else if (currencyFields.includes(originalColumn)) {
          ws[cellAddress].z = '$#,##0'
        }
        // Format number fields
        else if (numberFields.includes(originalColumn)) {
          ws[cellAddress].z = '#,##0'
        }
      }
    }
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Property Data')
    
    // Generate Excel file and download
    XLSX.writeFile(wb, 'formatted-table.xlsx')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">CSV Table Formatter</h1>
          <p className="text-lg text-gray-600">Create professionally formatted tables for your reports</p>
        </div>

        {/* Upload Section */}
        {!csvData && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload CSV File
              </CardTitle>
              <CardDescription>
                Upload a CSV file to get started. Priority columns will be selected by default, and you can customize the selection and order.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="upload-area"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">Drag and drop your CSV file here</p>
                <p className="text-gray-500 mb-4">or</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                <Button 
                  className="brand-primary cursor-pointer"
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  Choose File
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Column Management */}
        {csvData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Column Selection
                </CardTitle>
                <CardDescription>
                  Choose which columns to include in your table (priority columns selected by default)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {headers.map((header, index) => {
                    const isPriority = priorityColumns.includes(header)
                    return (
                      <div key={header} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={header}
                          checked={selectedColumns.includes(header)}
                          onChange={() => handleColumnToggle(header)}
                          className="rounded"
                        />
                        <label htmlFor={header} className="flex-1 text-sm">
                          {header}
                          {header === 'Median Weekly Rent' && (
                            <span className="text-xs text-blue-600 ml-1">(calculated)</span>
                          )}
                        </label>
                        <Badge variant={selectedColumns.includes(header) ? "default" : "secondary"}>
                          {selectedColumns.includes(header) ? "Included" : "Excluded"}
                        </Badge>
                        {isPriority && (
                          <Badge variant="outline" className="text-xs">
                            Priority
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Column Order & Renaming
                </CardTitle>
                <CardDescription>
                  Drag to reorder columns and customize column names
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="columns">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {selectedColumns.map((column, index) => (
                          <Draggable key={column} draggableId={column} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`space-y-1 p-3 border rounded-lg bg-white ${
                                  snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                  </div>
                                  <label className="text-sm font-medium text-gray-700 flex-1">
                                    {column}
                                    {percentageFields.includes(column) && (
                                      <span className="text-xs text-green-600 ml-1">(% format)</span>
                                    )}
                                    {currencyFields.includes(column) && (
                                      <span className="text-xs text-blue-600 ml-1">($ format)</span>
                                    )}
                                    {numberFields.includes(column) && (
                                      <span className="text-xs text-purple-600 ml-1">(number format)</span>
                                    )}
                                  </label>
                                  <span className="text-xs text-gray-500">#{index + 1}</span>
                                </div>
                                <Input
                                  value={columnRenames[column] || column}
                                  onChange={(e) => handleColumnRename(column, e.target.value)}
                                  placeholder="Enter new column name"
                                  className="mt-1"
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table Preview */}
        {tableData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Table Preview
              </CardTitle>
              <CardDescription>
                Preview of your formatted table ({tableData.length} rows) - Percentages and currency automatically formatted
              </CardDescription>
              <div className="flex gap-2">
                <Button onClick={exportTableHTML} className="brand-accent">
                  <Download className="h-4 w-4 mr-2" />
                  Export HTML
                </Button>
                <Button onClick={exportTableExcel} className="brand-primary">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button 
                  onClick={() => handleFileUpload(null)} 
                  variant="outline"
                  className="ml-auto"
                >
                  Upload New File
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="brand-table">
                  <thead>
                    <tr>
                      {Object.keys(tableData[0] || {}).map(header => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        {Object.keys(tableData[0] || {}).map(header => (
                          <td key={header}>{row[header] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tableData.length > 10 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Showing first 10 rows of {tableData.length} total rows
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>CSV Table Formatter - Create professional tables for your reports</p>
        </div>
      </div>
    </div>
  )
}

export default App

