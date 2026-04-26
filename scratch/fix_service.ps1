$filePath = 'f:\coding\Cricket Project\cricket-backend\main-app\src\modules\live-match\live-match.service.ts'
$content = Get-Content $filePath -Raw
$content = $content.Replace('if (updateDto.isMatchNew !== undefined) matchUpdate.isMatchNew = updateDto.isMatchNew;', 'if (updateDto.isMatchNew !== undefined || updateDto.isNew !== undefined) { matchUpdate.isMatchNew = updateDto.isMatchNew ?? updateDto.isNew; }')
$content = $content.Replace('if (updateDto.noCommentry !== undefined) matchUpdate.noCommentry = updateDto.noCommentry;', 'if (updateDto.noScorecards !== undefined) matchUpdate.noScorecards = updateDto.noScorecards; if (updateDto.noCommentry !== undefined) matchUpdate.noCommentry = updateDto.noCommentry;')
Set-Content $filePath $content
