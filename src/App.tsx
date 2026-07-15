import React, { useState, useMemo, useEffect } from 'react';
import { useEvolutionLoop } from './application/useEvolutionLoop';
import { BlueprintService } from './domain/BlueprintService';
import { ShapeType, Organism, CellType, FamilyType } from './domain/types';
import { AtomicNormalizer } from './domain/AtomicNormalizer';
import { isAdminBuild } from './config';

// UI Components
import { UnifiedStage } from './infrastructure/visuals/UnifiedStage';
import { CommandBar } from './ui/CommandBar';
import { ToolDock } from './ui/ToolDock';
import { SettingsDrawer } from './ui/SettingsDrawer';
import { StatsOverlay } from './ui/StatsOverlay';
import { ChampionAnalysis } from './ui/ChampionAnalysis';
import { Leaderboard } from './ui/Leaderboard';
import { EnergyBar } from './ui/EnergyBar';
import { FpsStats } from './ui/FpsStats';
import { VaultPanel } from './ui/VaultPanel';
import { Toaster, toast } from 'sonner';
import { Archive } from 'lucide-react';
import { PhysicsConfigProvider } from './application/PhysicsConfigContext';

export type EditorTool = 'VIEW' | 'BUILD' | 'ERASE';

function App() {
  const {
    population,
    generation,
    setGeneration,
    trackedLeaderId,
    statsRef,
    fitnessHistory, 
    isRunning,
    isAutoEvolving,
    settings, // Extracting the single settings object
    setIsRunning,
    toggleAutoEvolve, 
    spawnCustom,
    saveCreature,
    saveBatchChampions,
    loadCreature,
    loadBatchCreatures,
    getAllChampions,
    familyOrder,
    cycleTrackedLeader,
  } = useEvolutionLoop();

  // STATE MACHINE
  const [status, setStatus] = useState<'EDITING' | 'SIMULATING'>('EDITING');
  const [showBestOnly, setShowBestOnly] = useState(true);
  
  // EDITOR STATE
  const blueprintService = useMemo(() => new BlueprintService(), []);
  const [blueprintCells, setBlueprintCells] = useState(blueprintService.getCells());
  const [blueprintType, setBlueprintType] = useState(ShapeType.CUBE);
  const [editorTool, setEditorTool] = useState<EditorTool>('VIEW');
  const [brushType, setBrushType] = useState<CellType>(CellType.BODY); 
  const [isSymmetryEnabled, setIsSymmetryEnabled] = useState(true);
  const [editingOrganism, setEditingOrganism] = useState<Organism | undefined>(undefined);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [hasRestoredBootSeed, setHasRestoredBootSeed] = useState(false);

  // --- LOCAL BOOT RESTORATION (SOT SYNC) ---
  useEffect(() => {
      if (hasRestoredBootSeed) return;

      const restoreMasterOnBoot = async () => {
          try {
              const { localVault } = await import('./infrastructure/local/LocalVault');
              let allChampions: { family: FamilyType; generation: number; snapshot: any }[] = await localVault.getAllLocalChampions();

              if (allChampions.length === 0) {
                  try {
                      const { championCloudVault } = await import('./infrastructure/cloud/ChampionCloudVault');
                      allChampions = await championCloudVault.getAllCloudChampions();
                  } catch (cloudErr) {
                      console.error("Cloud boot restoration failed", cloudErr);
                  }
              }

              if (allChampions.length > 0 && generation === 1) {
                  // Find the best to be the primary template
                  const bestEntry = allChampions.sort((a,b) => b.generation - a.generation)[0];
                  const snapshot = bestEntry.snapshot as any;

                  const org = AtomicNormalizer.sanitize({
                      ...snapshot,
                      neuralGenome: snapshot.neuralGenome || snapshot.genome
                  });

                  if (!org.neuralGenome) return;

                  // 1. Sync the Blueprint Editor
                  blueprintService.importOrganism(org);
                  setBlueprintCells(blueprintService.getCells());
                  setBlueprintType(org.shape || ShapeType.CUBE);
                  setEditingOrganism(org);

                  // 2. Sync the Simulation Engine (restore all families)
                  const sanitizedChamps = allChampions.map(c => AtomicNormalizer.sanitize(c.snapshot));
                  spawnCustom(org, false, sanitizedChamps); // restore from all
                  
                  // 3. UI Generation Update
                  setGeneration(org.generation);
                  
                  setHasRestoredBootSeed(true);
                  toast.info(`Local Session Restored`, {
                      description: `Generator ${org.generation} loaded with ${allChampions.length} families.`
                  });
              }
          } catch (err) {
              console.error("Local boot restoration failed", err);
          }
      };

      restoreMasterOnBoot();
  }, [hasRestoredBootSeed, generation, blueprintService, spawnCustom, setGeneration]);

  // AUTO-SYNC STATUS WITH RUNNING STATE
  // REMOVED: This was causing "Pause" to trigger a reset by switching to EDITING mode.
  // status is now only switched by handlePlay (Simulate) and handleStop (Edit).

  // --- HANDLERS ---

  const handlePlay = () => {
      // 1. Generate Organism from Blueprint
      // Pass 'editingOrganism' to graft the brain if it exists
      const organism = blueprintService.generateOrganism('prototype', editingOrganism);
      
      // 2. Inject into Engine and Start
      spawnCustom(organism, true); // true = autoStart
      
      // 3. Switch State
      setStatus('SIMULATING');
  };

  const handleStop = () => {
      setIsRunning(false);
      // If Auto Evolving (Fast Forward), stop it
      if (isAutoEvolving) toggleAutoEvolve();
      
      setStatus('EDITING');
  };

  // --- BLUEPRINT ACTIONS ---

  const handleLoad = (file: File) => {
      loadCreature(file, (org) => {
          blueprintService.importOrganism(org);
          setBlueprintCells(blueprintService.getCells());
          setBlueprintType(org.shape || ShapeType.CUBE);
          setEditingOrganism(org);
          setStatus('EDITING');
      });
  };

  const handleLoadBatch = (file: File) => {
      loadBatchCreatures(file, (orgs) => {
          const sanitizedChamps = orgs.map(s => AtomicNormalizer.sanitize(s));
          const best = sanitizedChamps.reduce((a, b) => (a.fitness ?? 0) > (b.fitness ?? 0) ? a : b);
          
          spawnCustom(best, false, sanitizedChamps);
          blueprintService.importOrganism(best);
          setBlueprintCells(blueprintService.getCells());
          setBlueprintType(best.shape || ShapeType.CUBE);
          setEditingOrganism(best);
          setStatus('SIMULATING');
          
          toast.success(`Batch loaded: ${sanitizedChamps.length} champions restored.`);
      });
  };

  const handleCellClick = (x: number, y: number, z: number, isRight: boolean) => {
      if (isRight) {
          blueprintService.setCell(x, y, z, null, isSymmetryEnabled); // Erase
      } else {
          blueprintService.setCell(x, y, z, brushType, isSymmetryEnabled); // Build with active brush
      }
      setBlueprintCells(blueprintService.getCells());
  };

  const handleGenerate = (type: string) => {
      setEditingOrganism(undefined); // Fresh brain
      if (type === 'small') blueprintService.generateSmallCritter();
      if (type === 'large') blueprintService.generateLargeBeast();
      if (type === 'monster') blueprintService.generateMonster();
      if (type === 'spider') blueprintService.applySpider();
      if (type === 'octo') blueprintService.applyOcto();
      if (type === 'mirror') blueprintService.applyMirrorX();
      
      setBlueprintCells(blueprintService.getCells());
  };

  const handleClear = () => {
      blueprintService.clear();
      setBlueprintCells([]);
      setEditingOrganism(undefined);
  };

  const handleExportMatrix = () => {
      const json = blueprintService.exportToJSON();
      navigator.clipboard.writeText(json).then(() => {
          alert("Creature Matrix copied to clipboard!");
      }).catch(err => {
          console.error("Clipboard error", err);
          // Fallback: log to console
          console.log("Creature Matrix:", json);
          alert("Check console for Matrix Data (Clipboard blocked)");
      });
  };

  const handleImportMatrix = () => {
      const input = prompt("Paste Creature Matrix JSON here:");
      if (input) {
          try {
              blueprintService.importFromJSON(input);
              setBlueprintCells(blueprintService.getCells());
              setEditingOrganism(undefined); // Reset brain for new structure
              alert("Creature Matrix imported successfully!");
          } catch (e) {
              alert("Invalid Matrix Data. Please check the format.");
          }
      }
  };

  const handleBulkLoad = (snapshots: Organism[]) => {
      if (!snapshots || snapshots.length === 0) return;

      // Ensure proper normalization for everything
      const sanitizedChamps = snapshots.map(s => AtomicNormalizer.sanitize(s));
      
      // Determine the overall best to be the template
      const best = sanitizedChamps.reduce((a, b) => (a.fitness ?? 0) > (b.fitness ?? 0) ? a : b);

      // We no longer strictly wipe the layout in editor! Or wait, setTemplateAndReset does it.
      spawnCustom(best, false, sanitizedChamps);

      // Synchronize editor visuals with the best champion
      blueprintService.importOrganism(best);
      setBlueprintCells(blueprintService.getCells());
      setBlueprintType(best.shape || ShapeType.CUBE);
      setEditingOrganism(best);
      
      // Skip the editor and go straight to simulator to preserve the matrix
      setStatus('SIMULATING');
      setIsVaultOpen(false);
      
      toast.success(`Matrix Loaded: Synchronized ${sanitizedChamps.length} families.`);
  };
  
  const handleSetShape = (t: ShapeType) => {
      setBlueprintType(t);
      blueprintService.setType(t);
      setBlueprintCells([...blueprintService.getCells()]);
  };

  return (
    <PhysicsConfigProvider settings={settings}>
    <div className="relative w-full h-full overflow-hidden bg-slate-900 select-none">
      
      {/* 3D STAGE */}
      <UnifiedStage 
          status={status}
          population={population}
          showBestOnly={showBestOnly}
          trackedLeaderId={trackedLeaderId}
          // Edit Props
          blueprintCells={blueprintCells}
          blueprintType={blueprintType}
          editorTool={editorTool}
          brushType={brushType}
          onCellClick={handleCellClick}
      />

      {/* --- HUD OVERLAYS --- */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-full min-w-[1024px] -translate-x-1/2">
        <div className="pointer-events-auto">
          <EnergyBar
              status={status}
              statsRef={statsRef}
              trackedLeaderId={trackedLeaderId}
          />
        </div>

        {status === 'SIMULATING' && (
            <div className="absolute top-24 right-4 z-40 pointer-events-auto select-none w-64 flex flex-col gap-4">
              <StatsOverlay 
                  status={status}
                  statsRef={statsRef}
                  cellCount={blueprintCells.length}
                  isProcessing={false} 
                  progress={0}
                  fitnessHistory={fitnessHistory}
                  currentGeneration={generation}
                  cycleTrackedLeader={cycleTrackedLeader}
              />
              <ChampionAnalysis statsRef={statsRef} />
            </div>
        )}

        {status === 'SIMULATING' && (
            <div className="pointer-events-none absolute inset-0">
               <Leaderboard population={[...population]} familyOrder={familyOrder} />
            </div>
        )}

        <div className="pointer-events-auto">
          <ToolDock 
              status={status}
              editorTool={editorTool}
              setEditorTool={setEditorTool}
              brushType={brushType}
              setBrushType={setBrushType}
              isSymmetryEnabled={isSymmetryEnabled}
              setIsSymmetryEnabled={setIsSymmetryEnabled}
              currentShape={blueprintType}
              setShape={handleSetShape}
              onClear={handleClear}
              onGenerate={handleGenerate}
              onExportMatrix={handleExportMatrix}
              onImportMatrix={handleImportMatrix}
          />
        </div>

        <div className="pointer-events-auto">
          <CommandBar 
              status={status}
              isRunning={isRunning}
              isAutoEvolving={isAutoEvolving}
              generation={generation}
              onPlay={handlePlay}
              onStop={handleStop}
              onTogglePause={() => setIsRunning(!isRunning)}
              onToggleAuto={toggleAutoEvolve}
          />
        </div>

        {isAdminBuild && (
          <div className="pointer-events-auto">
            <SettingsDrawer
                showBestOnly={showBestOnly}
                onToggleBestOnly={() => setShowBestOnly(!showBestOnly)}
                onSave={saveBatchChampions}
                onLoad={handleLoadBatch}
                onVaultOpen={() => setIsVaultOpen(true)}
            />
          </div>
        )}

        {/* FPS STATS (Bottom Left) */}
        <div className="absolute bottom-6 left-6 pointer-events-auto">
           <FpsStats />
        </div>

        {/* VAULT PANEL */}
        <div className="pointer-events-auto">
          <VaultPanel 
            isOpen={isVaultOpen} 
            onClose={() => setIsVaultOpen(false)} 
            activeChampions={getAllChampions()}
            onLoadBulk={handleBulkLoad}
          />
        </div>

        <div className="pointer-events-auto">
          <Toaster position="bottom-right" theme="dark" />
        </div>
      </div>
    </div>
    </PhysicsConfigProvider>
  );
}

export default App;