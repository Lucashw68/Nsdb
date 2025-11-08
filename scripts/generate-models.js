#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'

const cwd = process.cwd()
const typesPath = path.resolve(cwd, 'types/database.types.ts')
const outDir = path.resolve(cwd, 'nsdb/models')
const barrelPath = path.resolve(cwd, 'nsdb/models.ts')
const templatePath = path.resolve(cwd, 'node_modules/@lucashw68/nsdb/templates/model.template.ts') // ajuste si besoin

if (!fs.existsSync(typesPath)) {
    console.error(`❌ Fichier introuvable : ${typesPath}`)
    process.exit(1)
}

const project = new Project({ skipAddingFilesFromTsConfig: true })
const sf = project.addSourceFileAtPath(typesPath)

let db
try {
    db = sf.getTypeAliasOrThrow('Database')
} catch {
    console.error(`❌ Type alias "Database" introuvable dans ${typesPath}`)
    process.exit(1)
}

const publicType = db.getType().getProperty('public')?.getTypeAtLocation(db)
const tablesType = publicType?.getProperty('Tables')?.getTypeAtLocation(db)
if (!tablesType) {
    console.error('❌ Impossible de trouver Database["public"]["Tables"]')
    process.exit(1)
}
const tables = tablesType.getProperties().map(p => p.getName())

const tpl = fs.readFileSync(templatePath, 'utf8')

fs.mkdirSync(outDir, { recursive: true })
const toPascal = s => s.replace(/(^|[_-]\w)/g, m => m.replace(/[_-]/,'').toUpperCase())
const singular = s => s.endsWith('s') ? s.slice(0, -1) : s

const exports = []

for (const table of tables) {
    const pascal = toPascal(table)
    const row = `${pascal}Row`

    // si tu as des stores Pinia générés : ~/stores/use<PascalSingular>Store
    const storeName = `use${toPascal(singular(table))}Store`
    const storePath = `~/stores/use${toPascal(singular(table))}Store`

    const WITH_STORE = fs.existsSync(
      path.resolve(cwd, `stores/use${toPascal(singular(table))}Store.ts`)
    )

    const code = tpl
      .replace(/__TABLE__/g, table)
      .replace(/__PASCAL__/g, pascal)
      .replace(/__ROW__/g, row)
      .replace(
        /__STORE_IMPORT__/g,
        WITH_STORE ? `import { ${storeName} } from '${storePath}'` : ''
      )
      .replace(
        /__STORE_CREATOR__/g,
        WITH_STORE ? `(() => ${storeName}())` : `undefined`
      )

    const file = path.join(outDir, `${table}.ts`)
    fs.writeFileSync(file, code, 'utf8')
    exports.push(`export * from './models/${table}' // use${pascal}, ${pascal}Schema`)
}

fs.writeFileSync(barrelPath, exports.join('\n') + '\n', 'utf8')
console.log(`✅ Generated ${tables.length} model modules into nsdb/models/`)
