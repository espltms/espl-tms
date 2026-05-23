$files = Get-ChildItem -Path "c:\Users\prave\Desktop\tms\frontend\app" -Recurse -Filter "*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Step 1: Protect button text (text-background -> placeholder)
    $content = $content -replace 'text-background', '__BTNW__'
    
    # Step 2: Background colors (dark -> light)
    $content = $content -replace 'bg-\[#09090b\]', 'bg-[#f4f6f9]'
    $content = $content -replace 'bg-\[#0c0c0e\]/80', 'bg-white/95'
    $content = $content -replace 'bg-\[#0c0c0e\]/40', 'bg-white/60'
    $content = $content -replace 'bg-\[#0c0c0e\]', 'bg-white'
    $content = $content -replace 'bg-\[#121214\]', 'bg-white'
    $content = $content -replace 'bg-\[#1c1c1f\]', 'bg-[#e2e8f0]'
    $content = $content -replace 'bg-\[#27272a\]', 'bg-[#e2e8f0]'
    $content = $content -replace 'bg-background', 'bg-[#f4f6f9]'
    
    # Step 3: Border/divide colors
    $content = $content -replace 'border-\[#1f1f23\]', 'border-[#e2e8f0]'
    $content = $content -replace 'border-\[#27272a\]', 'border-[#d1d5db]'
    $content = $content -replace 'divide-\[#1f1f23\]', 'divide-[#e2e8f0]'
    
    # Step 4: Hover states (before text-white replacement)
    $content = $content -replace 'hover:bg-white/5', 'hover:bg-slate-100'
    $content = $content -replace 'hover:bg-white/\[0\.01\]', 'hover:bg-slate-50'
    $content = $content -replace 'hover:bg-white/\[0\.02\]', 'hover:bg-slate-50'
    $content = $content -replace 'hover:bg-brand-slate', 'hover:bg-slate-100'
    $content = $content -replace 'bg-brand-slate', 'bg-slate-100'
    
    # Step 5: Text colors
    $content = $content -replace 'text-white', 'text-slate-800'
    $content = $content -replace 'text-gray-300', 'text-slate-600'
    $content = $content -replace 'text-gray-400', 'text-slate-500'
    $content = $content -replace 'text-gray-500', 'text-slate-400'
    $content = $content -replace 'text-gray-600', 'text-slate-400'
    
    # Step 6: Hover text (already converted from text-white)
    $content = $content -replace 'hover:text-slate-800', 'hover:text-slate-900'
    
    # Step 7: Overlays
    $content = $content -replace 'bg-black/70', 'bg-black/30'
    $content = $content -replace 'bg-black/60', 'bg-black/20'
    
    # Step 8: Foreground
    $content = $content -replace 'text-foreground', 'text-slate-700'
    
    # Step 9: Restore button text
    $content = $content -replace '__BTNW__', 'text-white'
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated: $($file.Name)"
}

Write-Host "`nTheme conversion complete for $($files.Count) files"
