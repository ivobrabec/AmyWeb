# Práce na amyweb

## Pull requesty

- Pull request, který otevře Claude, je draft. Testy běží v session, práce se
  pushuje v málo pushích a pull request se přepne na „ready“, až je hotový:
  CI i review Claudem pak proběhnou jednou. Další push spustí CI, ne review;
  review znovu se spouští ručně (Actions → claude-review → Run workflow, číslo
  pull requestu). Minuty GitHubu se počítají (6. 11. 2026).
