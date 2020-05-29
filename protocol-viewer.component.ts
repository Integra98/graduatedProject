import { CommonService } from './../../../../shared/services/common.service';
import { Component, OnInit, Inject, ViewEncapsulation, ViewChild, NgZone, HostListener, OnDestroy, ElementRef, ChangeDetectorRef } from '@angular/core';
import { distinctUntilChanged } from 'rxjs/internal/operators';
import { ITableInfo } from './../../../../shared/models/table.models';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog, MatSnackBar } from '@angular/material';
import { ISampleWithData, IDataItem, IProtocol, IGraphItem, DocMarkerType, IGraphImage, IReportWithHtml, IObjTemplateId, IResTemplateId, IItemWithChildren } from 'src/app/shared/models/journal-page.models';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { Subscription, combineLatest, forkJoin, Observable, of, Subject } from 'rxjs';
import { ModalForInsertContentComponent } from '../modal-for-insert-content/modal-for-insert-content.component';
import { IMarkerInfo } from 'src/app/shared/services/table.service';
import { IReturnedMarkerInfo } from 'src/app/shared/models/table.models';
import { PasteSingleValueMarkerComponent } from '../paste-single-value-marker/paste-single-value-marker.component';
import { PasteObjectMarkerComponent } from '../paste-object-marker/paste-object-marker.component';
import { InteractionService } from 'src/app/shared/services/interaction.service';
import { DocumentCacheService } from 'src/app/shared/services/document-cache.service';
import { ExpertCabinetService, IProtocolForTab } from 'src/app/shared/services/expert-cabinet.service';
import { JournalPageService } from 'src/app/shared/services/journal-page.service';
import { FormControl } from '@angular/forms';
import { IHtmlWithId, IHtmlWithMarkerName } from './../../../../shared/models/journal-page.models';
import { IApplication, ISample, IContentItem } from 'src/app/shared/models/main-page.models';
import { HttpEventType } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { TablesChartService } from 'src/app/modules/graphics-consctuctor/shared-files/tables-chart.service';
import { MainPageService } from 'src/app/shared/services/main-page.service';
import { DOCUMENT } from '@angular/common';
import { ISettingGraph } from './../../../../shared/models/intrfaces';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkStepperNext } from '@angular/cdk/stepper';
import { EventService } from 'src/app/shared/services/event.service';
import { YandexMetrikaService } from 'src/app/shared/services/yandex-metrika.service';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-protocol-viewer',
  templateUrl: './protocol-viewer.component.html',
  styleUrls: ['./protocol-viewer.component.scss'],
  // encapsulation: ViewEncapsulation.None,
  providers: [DocumentCacheService]
})
export class ProtocolAndReportViewerComponent implements OnInit, OnDestroy {

  ckeConfig: CKEditor4.Config;
  // HTML текщуего документа для редактора
  documentHtml: string = '';
  documentHtmlColtrol: FormControl = new FormControl('');

  @ViewChild('ckeditor', { static: false }) ckeditor: any;
  @ViewChild('editorContainer', { static: true }) editorContainer: any;


  application: IApplication;

  modalIsOpen: boolean = false;
  focusNodeParentElement: HTMLElement;
  selection: any;
  subscriptions: Array<Subscription> = [];

  editorIsLoaded: boolean = false;

  // массивы для разных типов содержания
  listOfLevel1Title: Array<IContentItem> = [];
  listOfLevelsTitle: Array<IContentItem> = [];
  listOfTablesTitle: Array<IContentItem> = [];
  listOfImagesTitle: Array<IContentItem> = [];
  listOfGraphsTitle: Array<IContentItem> = [];
  focusNode: HTMLElement;
  pageHeight: number = 1057;

  // массив всех проб заявки
  samples: Array<ISampleWithData> = [];
  // id текущей пробы
  currentSampleId: number = null;
  // id текущего протокола
  currentProtocolId: number = null;
  // index текущего протокола
  currentProtocolIndex: number = 0;
  // массив графиков, для передачи компоненту для отрисовки вне экрана
  graphicsForMarker: Array<IGraphItem> = [];
  // кол-во графиков, которое должно быть обработано
  graphicsForPasteCount: number = 0;

  // массив таблиц, для передачи компоненту для отрисовки вне экрана
  tablesForMarker: Array<IDataItem> = [];
  // кол-во таблиц, которое должно быть обработано
  tablesForPasteCount: number = 0;

  // массив, который содержит Observable для завершающей вставки в документ
  graphicsMarkerForPaste: Array<Observable<IGraphImage>> = [];
  // массив, который содержит Observable для завершающей вставки в документ
  tablesMarkerForPaste: Array<Observable<IHtmlWithId>> = [];

  // массив, который содержит Observable для завершающей вставки в документ маркера из заявки | пробы | значения из таблицы
  objectVariableMarkerForPaste: Array<Observable<IHtmlWithMarkerName>> = [];

  // массив, который содержит Observable для завершающей вставки в документ маркера заголовка таблиц и графиков
  tableAndGraphHeaderMarkerForPaste: Array<Observable<IHtmlWithId>> = [];

  // показывать ли компонент для отрисовки вне экрана и вставки из него новых данных маркеров
  showRenderObjectComponent: boolean = false;

  componentIsAlive: boolean = true;
  selectedProtocol;
  selectedSample;
  tabLoading: boolean = false;

  currentDocumentType: 'protocol' | 'report';
  contentLoading: boolean = false;
  tabIndexForUpdate: Array<number> = [];

  reportFile: IReportWithHtml;
  protocolFiles: IProtocolFile[] = [];
  apiUrl = environment.apiUrl;

  // показывает был ли изменен документ
  documentChanged: boolean = false;
  // массив содержаний для обновления
  contentListForRender = [];
  // число изменений в документе
  countOfChanges: number = 0;
  // показывает нужно ли сохранить документ в updateContentList
  saveDocumentMode: boolean = false;
  // Показывает что все обновления в документе завершены и можно начать отслеживать изменения
  editorIsReady = new Subject<boolean>();
  readyForUseEditor: boolean = false;
  // массив протоколов из всех проб
  protocolsForTabs: Array<IProtocolForTab> = [];

  currentTableFoeUpdate;

  // список таблиц для построения графиков ([{Item, children:[]}, etc...])
  dataForGraph: Array<IItemWithChildren> = [];
  // список таблиц c TemplateId
  tablesTemplateId: Array<IObjTemplateId> = [];
  templateIdForSubscribe: Array<Observable<IObjTemplateId>> = [];
  selectedContentItem: IContentItem;

  // флаг что все изменения при обновлении в редакторе завершены
  completedAllChanges: boolean = false;
  // флаг что необходимо обновить содержание
  needUpdateContents: boolean = true;
  // флаг что содержание обновлено
  completeUpdateContetLists: boolean;
  // флаг что это первое обновление содержания
  isFirstContentUpdate: boolean = true;
  //Таблицы и графики отображенные пользователю
  processedCharts: Array<string> = [];
  processedTables: Array<string> = [];

  // массивы таблиц и графиков, для передачи компоненту для отрисовки вне экрана при добавлении children of table
  childrenGraphicsForMarker: Array<IDataItem> = [];
  childrenTablesForMarker: Array<IDataItem> = [];

  // показывать ли компонент (for children) для отрисовки вне экрана и вставки из него новых данных маркеров
  showRenderObjectComponentForChildren: boolean = false;

  // массивы таблиц и графиков с html, для добавления графиков и копий таблиц
  childrenTablesMarkerForPaste: Array<Observable<IHtmlWithId>> = [];
  childrenGraphicsMarkerForPaste: Array<Observable<IGraphImage>> = [];

  isDocumentCompleted: boolean = null;

  constructor(public dialog: MatDialog,
    public dialogRef: MatDialogRef<ProtocolAndReportViewerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    @Inject(DOCUMENT) private document,
    private zone: NgZone,
    private snackBar: MatSnackBar,
    private documentCacheService: DocumentCacheService,
    private interactionService: InteractionService,
    private journalService: JournalPageService,
    private expertCabinetService: ExpertCabinetService,
    private tablesChartService: TablesChartService,
    private mainService: MainPageService,
    private cdr: ChangeDetectorRef,
    private commonService: CommonService,
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private yandexMetrika: YandexMetrikaService,
    private titleService: Title,
  ) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [this.data.type]: this.data.application.ID
      },
    });
    let dialogRefSubscription = this.dialogRef.afterClosed().subscribe(_ => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
      });
      dialogRefSubscription.unsubscribe();
    });
    // когда журнал отфильтрован по пробам
    if (typeof (data.application.SampleIndex) !== 'undefined') {
      console.log(data.application.SampleIndex, 'SampleIndex');
      // this.currentProtocolIndex = data.application.SampleIndex;
      // console.log(this.currentProtocolIndex);
    }
  }

  ngOnInit() {
    this.application = JSON.parse(JSON.stringify(this.data.application));
    this.currentDocumentType = JSON.parse(JSON.stringify(this.data.type));
    this.completeUpdateContetLists = this.currentDocumentType === 'report' ? false : true;

    if (this.currentDocumentType === 'report') {
      this.titleService.setTitle('Отчет: ' + (this.data.application as IApplication).OutAppNumbers);
    } else if (this.currentDocumentType === 'protocol') {
      this.titleService.setTitle('Протоколы: ' + (this.data.application as IApplication).OutAppNumbers);
    }

    this.setEditorConfig();
    this.getAllObjectsForCache();

    // tslint:disable-next-line: prefer-const
    let subscription1: Subscription = this.documentCacheService.graphicsMarkerUpdateEvent.subscribe((graphImage: IGraphImage) => {
      this.graphicsMarkerForPaste.push(of(graphImage));
      this.checkCompleteOfGettingMarkerValues();
    });
    this.subscriptions.push(subscription1);

    // tslint:disable-next-line: prefer-const
    let subscription2: Subscription = this.documentCacheService.tablesMarkerUpdateEvent.subscribe((tableWithId: IHtmlWithId) => {
      this.tablesMarkerForPaste.push(of(tableWithId));
      // console.log(tableWithId);
      this.checkCompleteOfGettingMarkerValues();
    });

    // subscription3 и subscription4 передают графики и объекты от render component
    let subscription3: Subscription = this.documentCacheService.graphicsChildrenMarkerUpdateEvent.subscribe((graphImage: IGraphImage) => {
      this.childrenGraphicsMarkerForPaste.push(of(graphImage));
      this.checkCompleteOfGettingMarkerValues();
    });

    let subscription4: Subscription = this.documentCacheService.tablesChildrenMarkerUpdateEvent.subscribe((htmlWithId: IHtmlWithId) => {
      this.childrenTablesMarkerForPaste.push(of(htmlWithId));
      this.checkCompleteOfGettingMarkerValues();
    });


    this.subscriptions.push(subscription2);
    this.subscriptions.push(subscription3);
    this.subscriptions.push(subscription4);

    this.editorIsReady.subscribe(res => {
      if (res) {
        this.readyForUseEditor = true;
      }
    });
  }

  /** Проверка, получены ли все данные для вставки новых значений маркеров в документ */
  checkCompleteOfGettingMarkerValues() {
    // console.log(this.graphicsMarkerForPaste.length === this.graphicsForPasteCount
    //   , this.tablesMarkerForPaste.length === this.tablesForPasteCount
    //   , this.childrenGraphicsMarkerForPaste.length === this.childrenGraphicsForMarker.length
    //   , this.childrenTablesMarkerForPaste.length === this.childrenTablesForMarker.length);
    if (this.graphicsMarkerForPaste.length === this.graphicsForPasteCount
      && this.tablesMarkerForPaste.length === this.tablesForPasteCount
      && this.childrenGraphicsMarkerForPaste.length === this.childrenGraphicsForMarker.length
      && this.childrenTablesMarkerForPaste.length === this.childrenTablesForMarker.length) {
      if (this.application.StatusID === 5) {
        this.editorIsLoaded = true;
        this.editorIsReady.next(true);
      } else {
        this.completeUpdateMarkers();
      }
    }
  }


  /** Обновление данных маркеров таблиц и графиков */
  completeUpdateMarkers() {
    forkJoin(
      this.tablesMarkerForPaste.length > 0 ? combineLatest(this.tablesMarkerForPaste) : of([]),
      this.graphicsMarkerForPaste.length > 0 ? combineLatest(this.graphicsMarkerForPaste) : of([]),
      this.objectVariableMarkerForPaste.length > 0 ? combineLatest(this.objectVariableMarkerForPaste) : of([]),
      this.tableAndGraphHeaderMarkerForPaste.length > 0 ? combineLatest(this.tableAndGraphHeaderMarkerForPaste) : of([]),
      this.childrenGraphicsMarkerForPaste.length > 0 ? combineLatest(this.childrenGraphicsMarkerForPaste) : of([]),
      this.childrenTablesMarkerForPaste.length > 0 ? combineLatest(this.childrenTablesMarkerForPaste) : of([])
    ).subscribe(result => {
      const parser = new DOMParser();
      let docHtml;
      docHtml = parser.parseFromString(this.documentHtmlColtrol.value, 'text/html');

      const markers = docHtml.body.querySelectorAll('.marker');
      /** Маркеры для вставки целых таблиц */
      // tslint:disable-next-line: prefer-const
      let tablesMarkers: Array<IHtmlWithId> = result[0];
      /** Маркеры для вставки целых графиков */
      // tslint:disable-next-line: prefer-const
      let graphicsMarkers: Array<IGraphImage> = result[1];

      /** Переменные из заявки | пробы | таблицы */
      // tslint:disable-next-line: prefer-const
      let objectVariableMarkers: Array<IHtmlWithMarkerName> = result[2];

      /** Маркеры для вставки заголовков таблиц */
      // tslint:disable-next-line: prefer-const
      let tableAndGraphHeaderMarkers: Array<IHtmlWithId> = result[3];

      // tslint:disable-next-line: prefer-for-of
      for (let index = 0; index < markers.length; index++) {
        let elementId: string;
        let templateId: string;
        let markerInfoStr: string;
        const marker: Element = markers[index];
        const markerType: DocMarkerType = marker.getAttribute('data-marker-type') as DocMarkerType;
        if (markerType) {
          if (markerType === 'table') {
            elementId = marker.getAttribute('data-marker-table');
            templateId = marker.getAttribute('data-marker-table-templateID');
            if (!templateId) {

              let tempId = this.tablesTemplateId.find(x => x.id === elementId)
              marker.setAttribute('data-marker-table-templateid', tempId.templateId);
              marker.setAttribute('data-marker-table', tempId.id);
              // marker.setAttribute('data-marker-table-templateid', res.ID);
              templateId = tempId.templateId;
            }

            if (elementId) {
              // tslint:disable-next-line: prefer-const
              let findedTableMarker = tablesMarkers.find(tableMarker => {
                return tableMarker.id === elementId;
              });
              if (!findedTableMarker) {
                findedTableMarker = tablesMarkers.find(tableMarker => {
                  return tableMarker.AnalysisTypeItemTemplateID === templateId;
                });
              }


              if (findedTableMarker) {
                if (this.processedTables.indexOf(findedTableMarker.id) === -1) {
                  this.processedTables.push(findedTableMarker.id);
                }

                marker.setAttribute('data-marker-table', findedTableMarker.id);
                marker.innerHTML = findedTableMarker.html;
                continue;
              }
            }


          }
          if (markerType === 'graph') {
            elementId = marker.getAttribute('data-marker-graph');

            if (elementId) {
              // tslint:disable-next-line: prefer-const
              let findedGraphicMarker = graphicsMarkers.find(graphicMarker => {
                return graphicMarker.id === elementId;
              });
              if (findedGraphicMarker) {
                (marker as HTMLImageElement).src = findedGraphicMarker.src;
                continue;
              }

            }
          }

          if (markerType === 'objectVariable') {
            markerInfoStr = marker.getAttribute('data-marker-info');
            let objMarkerInfoFromElement = JSON.parse(markerInfoStr);

            if (markerInfoStr) {
              let findedObjectVariableMarker;
              let newTableTemplateId;
              // console.log(`=== markerInfoStr = `, markerInfoStr);

              if (objMarkerInfoFromElement.markerType === 'tableCell') {
                objectVariableMarkers.map(obj => {
                  let objMarkerInfo = JSON.parse(obj.markerInfo);
                  if (objMarkerInfo.selectedTableRowId === objMarkerInfoFromElement.selectedTableRowId &&
                    objMarkerInfo.selectedTableColumnId === objMarkerInfoFromElement.selectedTableColumnId &&
                    objMarkerInfo.tableTemplateId === objMarkerInfoFromElement.tableTemplateId) {
                    findedObjectVariableMarker = obj;
                    newTableTemplateId = objMarkerInfo.tableId;
                  }
                });
                if (findedObjectVariableMarker) {

                  let newMarker = JSON.parse(findedObjectVariableMarker.markerInfo);

                  newMarker.tableId = newTableTemplateId;
                  let div = document.createElement('div');
                  div.innerHTML = findedObjectVariableMarker.html;
                  let newValue = '<span>&nbsp</span>' + div.textContent || div.innerText || '' + '<span>&nbsp</span>';
                  marker.setAttribute('data-marker-info', JSON.stringify(newMarker));
                  marker.innerHTML = newValue;
                  continue;
                }

              } else if (objMarkerInfoFromElement.markerType === 'appVariable') {

                // tslint:disable-next-line: prefer-const
                findedObjectVariableMarker = objectVariableMarkers.find(objectVariableMarker => {
                  return objectVariableMarker.markerInfo === markerInfoStr;
                });

                if (findedObjectVariableMarker) {
                  marker.innerHTML = findedObjectVariableMarker.html;
                  continue;
                }
              }

            }
          }
          if (markerType === 'table-header') {
            elementId = marker.getAttribute('data-marker-table');
            templateId = marker.getAttribute('data-marker-table-templateID');
            if (!templateId) {
              let tempId = this.tablesTemplateId.find(x => x.id === elementId)
              marker.setAttribute('data-marker-table-templateid', tempId.templateId);
              templateId = tempId.templateId;
            }

            if (elementId) {
              // tslint:disable-next-line: prefer-const
              // console.log(tableAndGraphHeaderMarkers);
              let findedTableHeaderMarker = tableAndGraphHeaderMarkers.find(tableHeaderMarker => {
                return tableHeaderMarker.id === elementId;
              });

              if (!findedTableHeaderMarker) {
                findedTableHeaderMarker = tableAndGraphHeaderMarkers.find(tableHeaderMarker => {
                  return tableHeaderMarker.AnalysisTypeItemTemplateID === templateId;
                });
              }
              if (findedTableHeaderMarker) {
                marker.setAttribute('data-marker-table', findedTableHeaderMarker.id);
                marker.setAttribute('readonly', 'true');
                marker.innerHTML = findedTableHeaderMarker.html;
                continue;
              }
            }
          }
          // if (markerType === 'graph-header') {
          //   elementId = marker.getAttribute('data-marker-graph');
          //   if (elementId) {
          //     // tslint:disable-next-line: prefer-const
          //     let findedGraphHeaderMarker = tableAndGraphHeaderMarkers.find(graphHeaderMarker => {
          //       return graphHeaderMarker.id === elementId;
          //     });
          //     if (findedGraphHeaderMarker) {
          //       marker.innerHTML = findedGraphHeaderMarker.html;
          //       continue;
          //     }
          //   }
          // }
        }
      }

      setTimeout(() => {
        // Удаление Anchors
        let anchors = docHtml.body.querySelectorAll('a');
        anchors.forEach(element => {
          this.removeAnchors(element);
        });

        if (this.currentDocumentType === 'report') {
          // Вставка children charts and copy table
          docHtml = this.setChildrenChartAndTables(result[4], result[5], docHtml);
        }

        // Добавление актуального комментария
        let findComStartIndex = docHtml.body.innerHTML.indexOf('<!-- {"processedTables"');
        if (findComStartIndex > -1) {
          docHtml.body.innerHTML = docHtml.body.innerHTML.slice(0, findComStartIndex);
        }
        let comment = '<!-- {"processedTables":[' + this.processedTables.map(tab => { return '"' + tab + '"' }) + '], "processedCharts":[' + this.processedCharts.map(chart => { return '"' + chart + '"' }) + ']} -->';
        // debugger;
        let newValue = docHtml.body.innerHTML + comment;
        docHtml.body.innerHTML = newValue;
        // console.log(docHtml.body.innerHTML);
        // debugger;

        let countAllMarkersForUpdate = this.objectVariableMarkerForPaste.length + this.tablesForMarker.length + this.tableAndGraphHeaderMarkerForPaste.length + this.graphicsForMarker.length;
        if (countAllMarkersForUpdate > 0) {
          this.saveBeforeEdit(docHtml.body.innerHTML);
        } else {
          this.setFinalValueInEditor(docHtml.body.innerHTML);
        }
      }, 1000);

      console.log('========================================');
      console.timeEnd('markers update complete time');
      console.log('========================================');
    });
  }

  setFinalValueInEditor(html: string) {

    this.documentHtmlColtrol.setValue(html);
    this.updateHeadersOfContentLists();
    this.detectPageOfTitle();
    // this.updateContentList();

    this.showRenderObjectComponent = false;
    this.graphicsForMarker = [];
    // кол-во графиков, которое должно быть обработано
    this.graphicsForPasteCount = 0;
    // массив таблиц, для передачи компоненту для отрисовки вне экрана
    this.tablesForMarker = [];
    // кол-во таблиц, которое должно быть обработано
    this.tablesForPasteCount = 0;

    // массив, который содержит Observable для завершающей вставки в документ
    this.graphicsMarkerForPaste = [];
    // массив, который содержит Observable для завершающей вставки в документ
    this.tablesMarkerForPaste = [];

    // массив, который содержит Observable для завершающей вставки в документ
    this.objectVariableMarkerForPaste = [];
    this.tableAndGraphHeaderMarkerForPaste = [];

    // массив, который содержит Observable для получения TemplateId
    this.templateIdForSubscribe = [];
    this.tablesTemplateId = [];

    this.editorIsLoaded = true;
    this.editorIsReady.next(true);
  }

  removeAnchors(element: any) {
    if (!element.text || element.text === ' ') {
      element.remove();
    } else {
      let childElement = element.children;
      if (childElement[0]) {
        element.replaceWith(childElement[0]);
      }
      // debugger;
      // if(childElement[0].childElementCount > 0) {
      //   if(childElement[0].children[0].tagName === 'a') {
      //     debugger;
      //       this.removeAnchors(childElement[0].children[0]);
      //   } else {
      //       element.replaceWith(childElement[0]);
      //   }
      // }
      // element.replaceWith(childElement[0]);
    }
  }

  getDocumentData() {
    if (this.currentDocumentType === 'report') {
      this.expertCabinetService.getApplicationReport(this.application.ID).subscribe((res: IReportWithHtml) => {
        this.reportFile = res;
        // this.isDocumentCompleted = res.;
        if (res.ReportHTML) {
          this.documentHtmlColtrol.setValue(res.ReportHTML);
          // this.startUpdateDocumentMarkers();
          this.checkMarkersTemplateID();
        } else {
          this.documentHtmlColtrol.setValue('');
          this.editorIsLoaded = true;
        }
        this.tabLoading = false;
      });
    }
    if (this.currentDocumentType === 'protocol') {
      this.expertCabinetService.getSampleProtocols(this.currentSampleId, this.currentProtocolId).subscribe(res => {
        if (res && res.length > 0 && res[0].ProtocolHTML) {
          this.protocolFiles = res;
          this.documentHtmlColtrol.setValue(res[0].ProtocolHTML);
          this.isDocumentCompleted = res[0].IsProtocolCompleted;
          this.checkMarkersTemplateID();
        } else {
          this.documentHtmlColtrol.setValue('');
          this.editorIsLoaded = true;
        }

        this.completedAllChanges = true;
        this.tabLoading = false;
      });
    }
  }

  /** Получение всех нужных данных для сохранения в кэше */
  getAllObjectsForCache() {
    this.journalService.getApplicationSamples(this.data.application.ID).subscribe((response: Array<ISample>) => {
      this.samples = response.map((sampleItem, index) => {
        const sample: ISampleWithData = {
          ID: sampleItem.ID,
          FieldID: sampleItem.FieldID,
          UserID: sampleItem.UserID,
          ApplicationID: sampleItem.ApplicationID,
          SamplesCount: sampleItem.SamplesCount,
          FieldTitle: sampleItem.FieldTitle,
          SamplerTypeTitle: sampleItem.SamplerTypeTitle,
          SampleUserIDs: sampleItem.SampleUserIDs,
          HoleNumber: sampleItem.HoleNumber,
          SamplerTypeID: sampleItem.SamplerTypeID,
          Depthes: sampleItem.Depthes,
          IsRecombined: sampleItem.IsRecombined,
          Horizon: sampleItem.Horizon,
          Temperature: sampleItem.Temperature,
          Pressure: sampleItem.Pressure,
          SampleDate: sampleItem.SampleDate,
          ReceiptDate: sampleItem.ReceiptDate,
          UpdatedOn: sampleItem.UpdatedOn,
          Note: sampleItem.Note,
          DelUserID: sampleItem.DelUserID,
          DeletedOn: sampleItem.DeletedOn,
          BringerName: sampleItem.BringerName,
          BringerPosition: sampleItem.BringerPosition,
          Applications: sampleItem.Applications,
          Fields: sampleItem.Fields,
          SamplerTypes: sampleItem.SamplerTypes,
          SampleAnalysisTypeItems: [...sampleItem.SampleAnalysisTypeItems],
          SamplePerforationIntervals: [...sampleItem.SamplePerforationIntervals],

          name: `Проба ${index + 1}`,
          protocols: [],
          tables: [],
          graphics: []
        };
        return sample;
      });

      // tslint:disable-next-line: prefer-const
      let requestsToProtocols: Array<any> = [];
      // tslint:disable-next-line: prefer-const
      let requestsForSampleData: Array<any> = [];
      // tslint:disable-next-line: prefer-const
      let requestsForSampleDataForRenderGraph: Array<any> = [];

      this.samples.map(sample => {
        requestsToProtocols.push(this.expertCabinetService.getSampleProtocols(sample.ID));
        requestsForSampleData.push(this.journalService.getSampleAnalysisTypeItemDataSimplified(sample.ID));
        requestsForSampleDataForRenderGraph.push(this.journalService.getSampleAnalysisTypeItemData(sample.ID));
      });

      if (this.samples.length > 0) {
        this.currentSampleId = this.samples[0].ID;

        forkJoin(
          requestsToProtocols.length > 0 ? combineLatest(requestsToProtocols) : of([]),
          requestsForSampleData.length > 0 ? combineLatest(requestsForSampleData) : of([]),
          requestsForSampleDataForRenderGraph.length > 0 ? combineLatest(requestsForSampleDataForRenderGraph) : of([]),
        ).subscribe(result => {
          // tslint:disable-next-line: prefer-const
          let protocolsBySamples: Array<Array<IProtocol>> = result[0];
          protocolsBySamples.map((protocols, index) => {
            this.samples[index].protocols = protocols;
          });

          // tslint:disable-next-line: prefer-const
          let tablesAndGraphics = result[1];

          tablesAndGraphics.map((tablesAndGraphicsItem, index) => {
            tablesAndGraphicsItem.map(item => {
              if (item.TemplateTypeID === 3) {
                item.DataJSON = JSON.parse(item.DataJSON);
                if (item.DataJSON) {
                  this.samples[index].tables.push(item);
                }
              } else if (item.TemplateTypeID === 5) {
                item.DataJSON = JSON.parse(item.DataJSON);
                // debugger;
                this.samples[index].graphics.push({ graph: item, table: this.findParentTable(tablesAndGraphicsItem, item.ParentID) });
              }
            });
          });



          // tslint:disable-next-line: prefer-const
          let sampleDataForRender = result[2];
          // console.log(`=== sampleDataForRender = `, sampleDataForRender);
          // tslint:disable-next-line: prefer-const
          let sampleDataForRenderResult = [];
          sampleDataForRender.map(resItem => {
            // debugger;
            resItem.map(r => {
              // Таблицы для построения графиков
              r.Children.map(item => {
                // if(this.dataForGraph.indexOf(item) === -1){
                this.dataForGraph.push(item)
                // }
              });
              // tslint:disable-next-line: prefer-const
              let data = {
                dataJSON: null, /* Для общего блока */
                fullSortOrder: r.Item.FullSortOrder,
                id: r.Item.ID,
                isFolder: r.Item.IsFolder,
                lvl: r.Item.Lvl,
                parentID: r.Item.ParentID,
                templateJSON: r.Item.TemplateJSON,
                templateTypeID: r.Item.TemplateTypeID,
                title: r.Item.Title,
                typeItemID: r.Item.TypeItemID,
                typeItemTitle: r.Item.TypeItemTitle,
                component: '',
                description: '',
                active: false,
                children: r.Children, /* для таблиц и графиков */
                showGraph: true
              };
              sampleDataForRenderResult.push(data);
            });
          });
          // console.log(`=== sampleDataForRenderResult = `, sampleDataForRenderResult);
          this.tablesChartService.data = sampleDataForRenderResult;

          this.addDataToCache();
          // this.setCurrentProtocol(this.samples[0].ID, this.samples[0].protocols[0].ProtocolID);
          this.currentSampleId = this.samples[0].ID;
          if (this.samples[0].protocols[0]) {
            this.currentProtocolId = this.samples[0].protocols[0].ProtocolID;
          }
          this.getDocumentData();

          this.samples.map(sample => {
            let sampleID = sample.ID;
            let sampleName = sample.name;
            sample.protocols.map(pr => {
              let protocol: IProtocolForTab = { sampleID: sampleID, sampleName: sampleName, protocolID: null, protocolName: null };
              protocol.protocolID = pr.ProtocolID;
              protocol.protocolName = pr.ProtocolTitle;
              this.protocolsForTabs.push(protocol);
            });
          });
        });
      }

    });

  }

  /** Сохранение данных в кэш */
  addDataToCache() {
    this.documentCacheService.samplesCache.set('samples', this.samples);
  }
  /** Установка текущего протокола для переключения между табами протоколов */
  setCurrentProtocol(sampleId: number, protocolId: number, index: number) {
    this.currentProtocolIndex = index;
    if (this.documentChanged) {
      if (confirm('Вы хотите сохранить изменения?')) {
        this.saveHTML(this.currentProtocolId);
      }
    }

    this.tabLoading = true;
    this.currentSampleId = sampleId;
    this.currentProtocolId = protocolId;
    this.getDocumentData();
    this.editorIsLoaded = false;
    this.editorIsReady.next(false);
    this.readyForUseEditor = false;
    this.completedAllChanges = true;
    this.countOfChanges = 0;
    this.documentChanged = false;
  }

  /** Начало обновления маркеров документа */
  startUpdateDocumentMarkers() {
    console.time('markers update complete time');
    const parser = new DOMParser();
    const docHtml = parser.parseFromString(this.documentHtmlColtrol.value, 'text/html');
    const markers = docHtml.body.querySelectorAll('.marker');
    // tslint:disable-next-line: prefer-for-of
    for (let index = 0; index < markers.length; index++) {
      let elementId: string;
      let templateId: string;
      let markerInfoStr: string;
      let markerInfo: IMarkerInfo;
      const marker: Element = markers[index];

      const markerType: DocMarkerType = marker.getAttribute('data-marker-type') as DocMarkerType;
      if (markerType) {
        if (markerType === 'table') {
          elementId = marker.getAttribute('data-marker-table');
          templateId = marker.getAttribute('data-marker-table-templateid');
          // debugger;
          this.findTableById(elementId, templateId);
        }
        if (markerType === 'graph') {
          elementId = marker.getAttribute('data-marker-graph');
          if (elementId) {
            this.findGraphicById(elementId);
          }
        }

        if (markerType === 'objectVariable') {
          markerInfoStr = marker.getAttribute('data-marker-info');
          if (markerInfoStr) {
            markerInfo = JSON.parse(markerInfoStr);
            if (markerInfo.markerType === 'appVariable') {
              // if (markerInfo.applicationId === this.application.id) {
              // Заявка
              if (markerInfo.applicationId && markerInfo.applicationVariableName) {
                // if (markerInfo.applicationVariableName) {
                // console.log(`===this.application  = `, this.application);
                // console.log(`===markerInfo.applicationVariableName = `, markerInfo.applicationVariableName);
                // console.log(`===this.application[markerInfo.applicationVariableName]  = `, this.application[markerInfo.applicationVariableName]);
                if (this.application[markerInfo.applicationVariableName]) {

                  // tslint:disable-next-line: prefer-const
                  let markerValue = this.application[markerInfo.applicationVariableName];
                  if (markerInfo.applicationVariableName === 'SampleDate' || markerInfo.applicationVariableName === 'ReceiptDate' || markerInfo.applicationVariableName === 'PlanEndDate') {
                    markerValue = this.commonService.getConvertFullDate(markerValue);
                  }
                  this.objectVariableMarkerForPaste.push(of({ html: markerValue, markerInfo: markerInfoStr }));
                }
              }
              // Проба
              if (markerInfo.applicationId && markerInfo.sampleId && markerInfo.sampleVariableName) {
                // if (markerInfo.sampleId && markerInfo.sampleVariableName) {

                let sample;

                if (markerInfo.applicationId == this.application.ID) {
                  sample = this.samples.find(elem => elem.ID === markerInfo.sampleId);
                } else {
                  sample = this.samples[0];
                }

                if (sample) {
                  if (markerInfo.sampleVariableName === 'AnalysisTypes' || markerInfo.sampleVariableName === 'Users') {
                    continue;
                  } else {
                    if (sample[markerInfo.sampleVariableName]) {
                      let markerValue;
                      if (markerInfo.sampleIndexOfArrayElement !== null && markerInfo.sampleIndexOfArrayElement !== undefined && markerInfo.sampleVariableNameOfArrayElement) {
                        markerValue = sample[markerInfo.sampleVariableName][markerInfo.sampleIndexOfArrayElement][markerInfo.sampleVariableNameOfArrayElement];
                      } else if (markerInfo.sampleIndexOfArrayElement !== null && markerInfo.sampleIndexOfArrayElement !== undefined && !markerInfo.sampleVariableNameOfArrayElement) {
                        markerValue = sample[markerInfo.sampleVariableName][markerInfo.sampleIndexOfArrayElement];
                      } else {
                        markerValue = sample[markerInfo.sampleVariableName];
                      }

                      if (markerValue) {
                        // console.log(`=== markerValue = `, markerValue, typeof markerValue  );

                        if (markerInfo.sampleVariableName === 'SampleDate' || markerInfo.sampleVariableName === 'ReceiptDate' || markerInfo.sampleVariableName === 'PlanEndDate') {
                          markerValue = this.commonService.getConvertFullDate(markerValue);
                        }
                        this.objectVariableMarkerForPaste.push(of({ html: markerValue, markerInfo: markerInfoStr }));
                      } else {
                        console.warn(`=== markerInfo not found value = `, markerInfo);
                      }
                    }
                  }
                }
                // }
              }
            }
            if (markerInfo.markerType === 'tableCell') {
              if (markerInfo.tableId && markerInfo.selectedTableColumnId !== null && markerInfo.selectedTableColumnId !== undefined && markerInfo.selectedTableRowId !== null && markerInfo.selectedTableRowId !== undefined) {
                let markerValue;

                // tslint:disable-next-line: prefer-const
                let currentTable = this.findTableById(markerInfo.tableId, markerInfo.tableTemplateId, true);
                if (currentTable) {
                  let currentTableInfo: ITableInfo = currentTable.DataJSON;
                  // tslint:disable-next-line: prefer-const
                  let rowIndex = currentTableInfo.rows.findIndex(x => x.id === markerInfo.selectedTableRowId);
                  // tslint:disable-next-line: prefer-const
                  let columnIndex = currentTableInfo.columns.findIndex(x => x.id === markerInfo.selectedTableColumnId);

                  if (rowIndex !== undefined && rowIndex !== null && columnIndex !== undefined && columnIndex !== null) {
                    if (currentTableInfo.data.rows[rowIndex]) {
                      markerValue = currentTableInfo.data.rows[rowIndex].columns[columnIndex];
                      // TODO: Проверить надобность
                      if (markerValue instanceof Date) {
                        markerValue = this.commonService.getConvertFullDate(markerValue);
                      }

                    }
                    this.objectVariableMarkerForPaste.push(of({ html: markerValue, markerInfo: markerInfoStr }));

                  }
                }
              }
            }
          }
        }

        if (markerType === 'table-header') {
          elementId = marker.getAttribute('data-marker-table');
          templateId = marker.getAttribute('data-marker-table-templateid');

          // tslint:disable-next-line: prefer-const
          let findedTable = this.findTableById(elementId, templateId, true);
          if (findedTable) {
            let tableItemInfo: ITableInfo = findedTable.DataJSON;
            if (tableItemInfo && tableItemInfo.tableName !== null && tableItemInfo.tableName !== undefined && !this.findTableWithSimilarTemplateID(findedTable.AnalysisTypeItemTemplateID)) {
              this.tableAndGraphHeaderMarkerForPaste.push(of({ id: findedTable.ID, html: tableItemInfo.tableName, AnalysisTypeItemTemplateID: findedTable.AnalysisTypeItemTemplateID }));
            }

          }
        }
        // if (markerType === 'graph-header') {
        //   elementId = marker.getAttribute('data-marker-graph');
        //   templateId = marker.getAttribute('data-marker-graph-templateid');
        //   // tslint:disable-next-line: prefer-const
        //   if (elementId) {
        //     let graphName = this.findGraphicById(elementId, templateId, true);
        //     if (graphName) {
        //       this.tableAndGraphHeaderMarkerForPaste.push(of({ id: elementId, html: graphName, AnalysisTypeItemTemplateID: ''}));
        //     }
        //   }
        // }
      }
    }


    console.group('Обновление маркеров');
    console.log(`=== всего маркеров = `, markers.length);
    console.log(`=== число обновляемых маркеров из объектов = `, this.objectVariableMarkerForPaste.length);
    console.log(`=== число обновляемых маркеров таблиц = `, this.tablesForMarker.length);
    console.log(`=== число обновляемых маркеров заголовков таблиц и графиков = `, this.tableAndGraphHeaderMarkerForPaste.length);
    console.log(`=== число обновляемых маркеров графиков = `, this.graphicsForMarker.length);
    console.groupEnd();

    if (markers.length === 0) {
      this.editorIsLoaded = true;
    }
    this.tablesForPasteCount = this.tablesForMarker.length;
    this.graphicsForPasteCount = this.graphicsForMarker.length;

    if (this.currentDocumentType === 'report') {
      //Для добавления детей(графики и копированные таблицы) талиц в отчет
      this.findChildrenOfTablesForMarkers();
    }

    this.showRenderObjectComponent = true;
    this.checkCompleteOfGettingMarkerValues();
  }


  /**
   * Поиск таблицы по Id
   * @param needToReturnTableInfo нужно ли вернуть таблицу | Если идет поиск tableInfo для маркера значения из таблицы
   */
  findTableById(tableId: string, templateId: string, needToReturnTableInfo: boolean = false) {
    // tslint:disable-next-line: prefer-const
    let samples: Array<ISampleWithData> = this.documentCacheService.samplesCache.get('samples');
    for (const sample of samples) {
      // tslint:disable-next-line: prefer-const
      let findedTable = sample.tables.find(table => {
        return table.ID === tableId;
      });
      // debugger;
      if (findedTable) {
        if (needToReturnTableInfo) {
          return findedTable;
        } else {
          this.tablesForMarker.push(findedTable);
        }
        break;
      } else {
        if (needToReturnTableInfo) {
          return this.findTableByTemplateId(templateId, samples, needToReturnTableInfo);
        } else {
          this.findTableByTemplateId(templateId, samples, needToReturnTableInfo);
        }
      }
    }
  }

  findTableByTemplateId(templateId: string, samples: Array<ISampleWithData>, needToReturnTableInfo: boolean) {
    // console.log(`=== templateId = `, templateId );
    for (const sample of samples) {
      // tslint:disable-next-line: prefer-const
      let findedTable = sample.tables.find(table => {
        return table.AnalysisTypeItemTemplateID === templateId;
      });
      // console.log(sample.tables);
      // console.log(templateId);
      // debugger;
      if (findedTable) {
        if (needToReturnTableInfo) {
          return findedTable;
        } else {
          this.tablesForMarker.push(findedTable);
        }
        break;
      }
    }
  }


  /**
   * Поиск графика по id и добавление его в массив для отрисовки за границами пользовательского экрана
   */
  findGraphicById(graphId: string, needToReturnGraphName: boolean = false) {
    // tslint:disable-next-line: prefer-const
    let samples: Array<ISampleWithData> = this.documentCacheService.samplesCache.get('samples');
    for (const sample of samples) {
      // tslint:disable-next-line: prefer-const
      let findedGraph = sample.graphics.find(graphWithTable => {
        return graphWithTable.graph.ID === graphId;
      });
      if (findedGraph) {
        if (needToReturnGraphName) {
          let settingsGraph: ISettingGraph = findedGraph.graph.DataJSON;
          if (settingsGraph && settingsGraph.setting && settingsGraph.setting.name) {
            return settingsGraph.setting.name;
          }
        } else {
          this.graphicsForMarker.push(findedGraph);
        }
        break;
      }
    }
  }

  // Поиск таблиц с одинаковым tableTemplateId и которые не изменялись
  findTableWithSimilarTemplateID(tableTemplateId: string) {
    let findedTables = false;
    // tslint:disable-next-line: prefer-const
    this.dataForGraph.forEach(table => {
      if (table.Item.AnalysisTypeItemTemplateID === tableTemplateId && table.Item.DataJSON == null) {
        findedTables = true;
      }
    });

    return findedTables;
  }

  /** Сохранение html протокола по Id протокола */
  saveHTML(protocolID: number) {
    this.zone.run(() => {
      // this.updateContentList();
      if (this.currentDocumentType === 'protocol') {
        this.expertCabinetService.setSampleProtocolHtml(protocolID, this.documentHtml).subscribe(res => {

          this.editProtocolMetrikaCall();

          this.snackBar.open('Успешно сохранено', '', {
            duration: 3000,
          });
          this.documentChanged = false;
        });
      } else if (this.currentDocumentType === 'report') {
        this.saveDocumentMode = true;
        this.updateContentList();
      }

    });
  }

  saveBeforeEdit(html: string) {
    if (this.currentDocumentType === 'protocol') {
      this.expertCabinetService.setSampleProtocolHtml(this.currentProtocolId, html).subscribe(res => {
        this.setFinalValueInEditor(html);
      });
    } else if (this.currentDocumentType === 'report') {
      this.expertCabinetService.setReportHtml(this.application.ID, html).subscribe(res => {
        this.setFinalValueInEditor(html);
      });
    }

  }

  close() {
    // console.log(`CLOSE=== this.documentChanged = `,this.documentChanged );
    if (this.documentChanged) {
      if (confirm('Вы хотите сохранить изменения?')) {
        this.saveHTML(this.currentProtocolId);
      }
    }

    this.dialogRef.close();
  }

  //#region CK EDITOR (DOCUMENT) METHODS
  setEditorConfig() {
    // tslint:disable-next-line: prefer-const
    let self = this;
    this.ckeConfig = {
      width: this.editorContainer.nativeElement.offsetWidth - 30 + 'px',
      height: this.editorContainer.nativeElement.offsetHeight - 39 + 'px',
      // height: '796px', //330px
      // width: '1478px',
      language: 'ru',
      allowedContent: true,
      // This is optional, but will let us define multiple different styles for multiple editors using the same CSS file.
      bodyClass: 'document-editor',
      bodyId: 'ckeditor-body',
      // Reduce the list of block elements listed in the Format dropdown to the most commonly used.
      format_tags: 'p;h1;h2;h3;pre',
      // Simplify the Image and Link dialog windows. The "Advanced" tab is not needed in most cases.
      removeDialogTabs: 'image:advanced;link:advanced',
      toolbar: [
        { name: 'save', items: ['SaveAll'] }, //'updateContent'
        { name: 'download', items: ['downloadWord'] },
        { name: 'insert', items: ['addMarkerObject', 'Table'] },
        { name: 'basicstyles', items: ['Bold', 'Italic', 'Underline'] },
        { name: 'textstyles', items: ['FontSize', 'TextColor', 'BGColor'] },
        { name: 'paragraph', items: ['NumberedList', 'BulletedList'] },
        { name: 'script', items: ['Superscript', 'Subscript',] },
        { name: 'editing', items: ['Replace', 'RemoveFormat'] },
        { name: 'justify', items: ['JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock', '-', 'Outdent', 'Indent'] },
        { name: 'clipboard', items: ['-', 'Undo', 'Redo', '-'] },
        { name: 'styles', items: ['HeadersTypes'] },
        { name: 'marker', items: ['insertContent', 'uploadImage', 'addValueFromTable', 'removeMarker', 'Source'] }, //'Anchor', 'Source'
      ],
      on: {
        // tslint:disable-next-line: object-literal-shorthand
        pluginsLoaded: function () {
          // tslint:disable-next-line: one-variable-per-declaration
          // tslint:disable-next-line: prefer-const
          let editor = this;
          // tslint:disable-next-line: prefer-const
          let config = editor.config;

          editor.ui.addRichCombo('HeadersTypes', {
            label: 'Заголовки',
            title: 'Выбрать тип заголовка',
            top: '706px',
            panel: {
              // css: [ this.ckditor.instance.skin.getPath( 'editor' ) ].concat( config.contentsCss ),
              // css: [ editor.config.contentsCss, self.ckeditor.instance.skin.getPath('editor') ],
              multiSelect: false,
              attributes: { style: 'top: 706px !importnant;' }
            },
            // tslint:disable-next-line: object-literal-shorthand
            init: function () {
              this.add(
                'level1', 'Заголовок 1 уровня'
              );
              this.add(
                'level2', 'Заголовок 2 уровня'
              );
              this.add(
                'table', 'Заголовок таблицы'
              );
              this.add(
                'graph', 'Заголовок графика'
              );
              this.add(
                'image', 'Заголовок изображения'
              );
              this.add(
                '', 'Отменить'
              );
            },
            // tslint:disable-next-line: object-literal-shorthand tslint:disable-next-line: only-arrow-functions
            onClick: function (value) {
              self.zone.run(() => {
                editor.focus();
                // let selectionRange = self.ckeditor.instance.getSelection().getRanges();
                // let children = selectionRange[0].clone().cloneContents().getChildren();
                let selectedText = self.ckeditor.instance.getSelection().getSelectedText();

                // console.log(`=== self.ckeditor.instance.getSelection() = `, selectedText);
                // console.log(`=== focus = `, self.focusNode);
                // console.log(children.$);

                if (self.focusNode.innerText === selectedText) {
                  if (self.focusNode.hasAttribute('header-type')) {
                    self.focusNode.removeAttribute('header-type');
                  }
                  self.focusNode.setAttribute('header-type', value);
                } else {
                  let parentElement = self.focusNode.parentElement;
                  if (parentElement.innerText === selectedText) {
                    if (self.focusNode.hasAttribute('header-type') || parentElement.hasAttribute('header-type')) {
                      self.focusNode.removeAttribute('header-type');
                      parentElement.removeAttribute('header-type');
                    }
                    parentElement.setAttribute('header-type', value);

                  }
                }

                self.listOfTablesTitle = [];
                self.listOfImagesTitle = [];
                self.listOfGraphsTitle = [];
                self.listOfLevelsTitle = [];
                self.listOfLevel1Title = [];

                self.detectPageOfTitle();
                self.sortContent(self.listOfLevelsTitle);
                // console.log(`=== set header = `, self.listOfLevelsTitle);
              });
            }
          });
        }
      },
      contentsCss: '/assets/custom-styles/ckeditorstyles.css',
    };

    // this.ckeConfig.extraPlugins = 'indent';
    // this.ckeConfig.removePlugins = 'elementspath';
    this.ckeConfig.removePlugins = 'elementspath, link';
  }


  onReady(event) {
    this.setConfigOfEditor(event.editor.id);
    this.changeButtonIcon();

    this.ckeditor.instance.addCommand('addValueFromTable', {
      exec: (editor) => {
        this.addValueFromTableButtonClick();
      }
    });

    this.ckeditor.instance.contextMenu.addListener((element, selection) => {
      return {
        addValueFromTable: this.ckeditor.instance.TRISTATE_OFF
      };
    });

    this.ckeditor.instance.getCommand('RemoveMarker').disable();

    const subscriptionForTable = this.interactionService.selectTableOrGraphEventStart.subscribe(response => {
      this.ckeditor.instance.insertHtml('<span>&nbsp</span>' + response.html + '<span id= "' + response.id + '">&nbsp</span>');

      setTimeout(() => {
        this.interactionService.selectTableOrGraphEventComplete.next(true);
      }, 300);
    });
    this.subscriptions.push(subscriptionForTable);

    this.documentHtmlColtrol.valueChanges.pipe(
      distinctUntilChanged(),
    ).subscribe(newValue => {
      // console.log(`=== valueChanges = `, newValue);
      this.documentHtml = newValue;
    });

    if (this.application.StatusID === 5) {
      this.ckeditor.instance.setReadOnly(true);
    }

    // this.documentHtmlColtrol.valueChanges.pipe(
    //   distinctUntilChanged(),
    //   debounceTime(300),
    //   takeWhile(x => this.componentIsAlive)
    // ).subscribe(newValue => {
    //   console.log(`===  valueChanges=  debounceTime`, );

    //   // this.detectChangeOfHeaders();
    //   /
    //   // if (this.countOfChanges > 2) {
    //   //
    //   //   this.documentChanged = true;
    //   // }
    // });
  }

  changeButtonIcon() {
    let bold = this.document.getElementsByClassName('cke_button__bold_icon');
    let italic = this.document.getElementsByClassName('cke_button__italic_icon');
    let underline = this.document.getElementsByClassName('cke_button__underline_icon');

    if (bold[0] !== undefined) {
      bold[0].setAttribute('style', 'background: url(/assets/icons/bold.png) no-repeat -1px 1px !important;');
    }
    if (italic[0] !== undefined) {
      italic[0].setAttribute('style', 'background: url(/assets/icons/italic.png) no-repeat 0 1px !important;');
    }
    if (underline[0] !== undefined) {
      underline[0].setAttribute('style', 'background: url(/assets/icons/underline.png) no-repeat -1px 1px !important;');
    }

  }

  setConfigOfEditor(id: string) {
    // let topId = id + '_top';
    // let contentId = id + '_contents';
    let bottomId = id + '_bottom';
    // let top = this.document.getElementById(topId);
    // top.setAttribute('style', 'width: 1448px !important; ');
    // // currentDocumentType: 'protocol' | 'report';
    // let content = this.document.getElementById(contentId);
    // if(this.currentDocumentType == 'protocol') {
    //   content.setAttribute('style', 'width: 1463px !important; height: 256px !important; zoom: 3 !important;');
    // } else {
    //   content.setAttribute('style', 'width: 1463px !important; height: 282px !important; zoom: 3 !important;');
    // }
    let bottom = this.document.getElementById(bottomId);
    bottom.setAttribute('style', 'display: none !important;');
  }

  onChange(event) {
    // console.log(`=== this.readyForUseEditor = `, this.readyForUseEditor );
    if (this.application.StatusID !== 5) {
      if (this.readyForUseEditor) {
        if (this.currentDocumentType === 'report') {
          if (this.needUpdateContents) {
            this.updateContentList();
            this.needUpdateContents = false;
          }
        }
        // console.log(`=== this.completedAllChanges = `, this.completedAllChanges );
        if (this.completeUpdateContetLists) {
          if (this.completedAllChanges) {
            this.detectChangeOfHeaders();
            this.countOfChanges += 1;
            if (this.currentDocumentType === 'report') {
              this.documentChanged = true;
            } else {
              if (this.countOfChanges > 1) {
                this.documentChanged = true;
              }
            }
          }
        }
        this.completedAllChanges = true;
      }
    }
    // console.log(`##### this.countOfChanges = `, this.countOfChanges);
  }

  onFocus(event) {
    this.selection = this.ckeditor.instance.getSelection(); // text selection
    // this.ckeditor.instance.on('afterInsertHtml', (evt) => {
    //   // let focusNodeParentElem: HTMLElement = this.selection._.cache.nativeSel.focusNode.parentElement;
    //   // console.log(`=== afterInsertHtml || focusNodeParentElem = `, focusNodeParentElem);
    //   // focusNodeParentElem.blur();
    //   // focusNodeParentElem.focus();
    // });
    this.ckeditor.instance.on('selectionChange', (evt) => {
      // tslint:disable-next-line: prefer-const
      if (this.selection) {
        let focusNodeParentElem: HTMLElement = this.selection._.cache.nativeSel.focusNode.parentElement;
        this.focusNode = this.selection._.cache.nativeSel.focusNode.parentElement;
        if (focusNodeParentElem) {
          if (focusNodeParentElem.attributes['data-marker-info'] || (focusNodeParentElem.parentElement && focusNodeParentElem.parentElement.attributes['data-marker-info'])) {
            if (focusNodeParentElem.attributes['data-marker-info']) {
              this.focusNodeParentElement = focusNodeParentElem;
            } else if (focusNodeParentElem.parentElement.attributes['data-marker-info']) {
              this.focusNodeParentElement = focusNodeParentElem.parentElement;
            }

            this.ckeditor.instance.addMenuItems({
              addValueFromTable: { label: 'Изменить маркер', command: 'addValueFromTable', group: 'clipboard', order: 1 }
            });
          } else {
            this.ckeditor.instance.removeMenuItem({
              addValueFromTable: { label: 'Изменить маркер', command: 'addValueFromTable', group: 'clipboard', order: 1 }
            });

            this.focusNodeParentElement = null;
          }

          // tslint:disable-next-line: no-string-literal
          if (focusNodeParentElem.attributes['readonly'] || (focusNodeParentElem.parentElement && focusNodeParentElem.parentElement.attributes['readonly'])) {
            this.ckeditor.instance.setReadOnly(true);
            this.ckeditor.instance.getCommand('RemoveMarker').enable();
          } else {
            this.ckeditor.instance.setReadOnly(false);
            this.ckeditor.instance.getCommand('RemoveMarker').disable();
          }
        } else {
          this.ckeditor.instance.removeMenuItem({
            addValueFromTable: { label: 'Изменить маркер', command: 'addValueFromTable', group: 'clipboard', order: 1 }
          });
          this.focusNodeParentElement = null;
          this.ckeditor.instance.setReadOnly(false);
          this.ckeditor.instance.getCommand('RemoveMarker').disable();
        }

      }
    });
  }

  openEditingMarkerModal() {
    let currentMarkerInfo: IMarkerInfo;
    let markerInfoStr;
    if (this.focusNodeParentElement) {
      markerInfoStr = this.focusNodeParentElement.getAttribute('data-marker-info');
      if (markerInfoStr) {
        currentMarkerInfo = JSON.parse(markerInfoStr);
      }
    }
    const dialogRef = this.dialog.open(PasteSingleValueMarkerComponent, {
      hasBackdrop: true,
      disableClose: true,
      data: {
        markerInfo: currentMarkerInfo,
        application: this.data.application,
        index: this.currentProtocolIndex

      },
      width: '90%',
      height: '82%',
      maxWidth: '85vw !important',
      maxHeight: '85vh !important'
    });

    let dialogRefSubscription = dialogRef.afterClosed().subscribe((gettingMarkerInfoStr: IReturnedMarkerInfo) => {
      if (gettingMarkerInfoStr !== undefined) {
        if (this.focusNodeParentElement) {
          this.focusNodeParentElement.setAttribute('data-marker-info', gettingMarkerInfoStr.dataMarkerInfo);
          this.focusNodeParentElement.innerHTML = gettingMarkerInfoStr.displayValue.toString();
        } else {
          if (gettingMarkerInfoStr.displayValue2 !== undefined) {
            // tslint:disable-next-line: prefer-const
            let completeMarkerElem1 = `<span>&nbsp</span><span data-marker-type='objectVariable' data-marker-info='` + gettingMarkerInfoStr.dataMarkerInfo + `' class='marker' readOnly='true'>` + gettingMarkerInfoStr.displayValue + '</span><span>&nbsp</span>';
            let completeMarkerElem2 = `<span>&nbsp</span><span data-marker-type='objectVariable' data-marker-info='` + gettingMarkerInfoStr.dataMarkerInfo2 + `' class='marker' readOnly='true'>` + gettingMarkerInfoStr.displayValue2 + '</span><span>&nbsp</span>';
            this.ckeditor.instance.insertHtml(completeMarkerElem1 + ' - ' + completeMarkerElem2);
          } else {
            // tslint:disable-next-line: prefer-const
            let completeMarkerElem = `<span>&nbsp</span><span data-marker-type='objectVariable' data-marker-info='` + gettingMarkerInfoStr.dataMarkerInfo + `' class='marker' readOnly='true'>` + gettingMarkerInfoStr.displayValue + '</span><span>&nbsp</span>';
            this.ckeditor.instance.insertHtml(completeMarkerElem);
          }
        }
      }
      this.ckeditor.instance.focus();
      this.modalIsOpen = false;
      dialogRefSubscription.unsubscribe();
    });
  }

  openAddObjectMarkerModal() {
    let currentMarkerInfo: IMarkerInfo;
    let markerInfoStr;
    if (this.focusNodeParentElement) {
      markerInfoStr = this.focusNodeParentElement.getAttribute('data-marker-info');
      if (markerInfoStr) {
        currentMarkerInfo = JSON.parse(markerInfoStr);
      }
    }
    const dialogRef = this.dialog.open(PasteObjectMarkerComponent, {
      hasBackdrop: true,
      disableClose: true,
      data: {
        markerInfo: currentMarkerInfo,
        application: this.data.application,
        index: this.currentProtocolIndex,
        currentDocumentType: this.currentDocumentType
      },
      width: '95%',
      height: '82%',
      maxWidth: '85vw !important',
      maxHeight: '85vh !important'
    });

    let dialogRefSubscription = dialogRef.afterClosed().subscribe((gettingMarkerInfoStr: IReturnedMarkerInfo) => {
      this.ckeditor.instance.focus();

      console.log(`=== gettingMarkerInfoStr = `, gettingMarkerInfoStr);
      if (gettingMarkerInfoStr) {
        // console.log(`=== gettingMarkerInfoStr \n\t dataMarkerInfo = ${gettingMarkerInfoStr.dataMarkerInfo} \n\t displayValue = ${gettingMarkerInfoStr.displayValue}`);
        if (this.focusNodeParentElement) {
          this.focusNodeParentElement.setAttribute('data-marker-info', gettingMarkerInfoStr.dataMarkerInfo);

          this.focusNodeParentElement.innerHTML = gettingMarkerInfoStr.displayValue.toString();

        } else {
          let markerType;
          if (gettingMarkerInfoStr.dataMarkerInfo === 'table') {
            markerType = 'table';
          } else if (gettingMarkerInfoStr.dataMarkerInfo === 'graph') {
            markerType = 'graph';
          }
          // tslint:disable-next-line: prefer-const
          let completeMarkerElem = `<span>&nbsp</span><span data-marker-type='` + markerType + `' data-marker-info='` + gettingMarkerInfoStr.dataMarkerInfo + `' class='marker' readOnly='true'>` + gettingMarkerInfoStr.displayValue + '</span><span>&nbsp</span>';
          this.ckeditor.instance.insertHtml(completeMarkerElem);
        }
      }
      this.ckeditor.instance.focus();
      this.modalIsOpen = false;
      dialogRefSubscription.unsubscribe();
    });

  }

  addValueFromTableButtonClick() {
    if (!this.modalIsOpen) {
      this.modalIsOpen = true;
      this.zone.run(() => {
        this.openEditingMarkerModal();
      });
    }
  }

  addObjectMarkerButtonClick() {
    if (!this.modalIsOpen) {
      this.modalIsOpen = true;
      this.zone.run(() => {
        this.openAddObjectMarkerModal();
      });
    }
  }

  removeMarker(event) {
    // tslint:disable-next-line: prefer-const
    let sel = this.ckeditor.instance.getSelection();
    // tslint:disable-next-line: prefer-const
    let el: HTMLElement = sel._.cache.nativeSel.focusNode.parentElement;
    if (el) {
      // tslint:disable-next-line: prefer-const
      let parentElem = el.parentElement;
      el.remove();
      if (parentElem && !parentElem.firstChild) {
        parentElem.remove();
      }
    }
  }

  updateContentList() {
    this.contentListForRender = [];
    console.log(`=== updateContentList = `);
    let contentLists = this.ckeditor.instance.document.find(`[content-list=true]`);
    if (contentLists.$.length > 0) {
      // tslint:disable-next-line: prefer-for-of
      for (let i = 0; i < contentLists.$.length; i++) {
        let contentType = contentLists.$[i].getAttribute('content-list-type');
        if (contentType === 'levels') {
          this.contentListForRender.push({ type: 'levels', list: this.listOfLevelsTitle });

        } else if (contentType === 'tables') {

          this.contentListForRender.push({ type: 'tables', list: this.listOfTablesTitle });
        } else if (contentType === 'graphs') {

          this.contentListForRender.push({ type: 'graphs', list: this.listOfGraphsTitle });
          // debugger;
        } else if (contentType === 'images') {

          this.contentListForRender.push({ type: 'images', list: this.listOfImagesTitle });
        }
      }
      this.contentLoading = true;
      this.cdr.detectChanges();
    }
    if (this.saveDocumentMode) {
      this.expertCabinetService.setReportHtml(this.application.ID, this.ckeditor.instance._.data).subscribe(res => {
        this.editReportMetrikaCall();
        this.snackBar.open('Успешно сохранено', '', {
          duration: 3000,
        });
        this.documentChanged = false;
      });
      this.saveDocumentMode = false;

    }
  }


  updateHeadersOfContentLists() {
    let headers = this.ckeditor.instance.document.find('span');
    headers.$.forEach(header => {
      if (header.innerText === 'СПИСОК ТАБЛИЦ') {
        header.setAttribute('content-list-type', 'tables');
        header.setAttribute('id', 'contentList_tables');
        header.setAttribute('content-list', 'true');

      } else if (header.innerText === 'СПИСОК РИСУНКОВ') {
        header.setAttribute('content-list-type', 'graphs');
        header.setAttribute('id', 'contentList_graphs');
        header.setAttribute('content-list', 'true');

      }
    });

  }

  setUpdatecontentList(event) {
    let exFocusEl;
    if (!this.isFirstContentUpdate) {
      if (this.selection) {
        exFocusEl = this.selection._.cache.nativeSel.focusNode.parentElement;
      }
    } else {
      exFocusEl = this.ckeditor.instance.document.$.body.firstElementChild;
    }

    for (let i = 0; i < event.length; i++) {
      let contentList = this.ckeditor.instance.document.find('[content-list-type = ' + event[i].type + ']');
      let el = this.ckeditor.instance.document.getById('contentList_' + event[i].type);
      // console.log(`=== el = `, el);
      this.ckeditor.instance.getSelection().selectElement(el);
      contentList.$[0].remove();
      this.ckeditor.instance.insertHtml(event[i].content);
      if (exFocusEl) {
        exFocusEl.scrollIntoView();
      }
      this.isFirstContentUpdate = false;
    }
    setTimeout(() => {
      this.contentLoading = false;
      this.completeUpdateContetLists = true;
      if (this.saveDocumentMode) {
        this.expertCabinetService.setReportHtml(this.application.ID, this.ckeditor.instance._.data).subscribe(res => {
          this.snackBar.open('Успешно сохранено', '', {
            duration: 3000,
          });
          this.documentChanged = false;
        });
        this.saveDocumentMode = false;
      }

      console.log(`=== Updated HEADERS! = `);
    }, 600);
  }


  detectPageOfTitle() {
    // console.log(`=== detectPageOftitle = `, );

    if (this.ckeditor.instance.document !== null && this.ckeditor.instance.document !== undefined) {
      // tslint:disable-next-line: prefer-const
      let level1 = this.ckeditor.instance.document.find(`[header-type=level1]`);
      // tslint:disable-next-line: prefer-const
      let level2 = this.ckeditor.instance.document.find(`[header-type=level2]`);
      // tslint:disable-next-line: prefer-const
      let table = this.ckeditor.instance.document.find(`[data-marker-type=table-header]`);
      // tslint:disable-next-line: prefer-const
      let image = this.ckeditor.instance.document.find(`[header-type=image]`);
      // tslint:disable-next-line: prefer-const
      let graph = this.ckeditor.instance.document.find(`[data-marker-type=graph]`);

      this.createItemOfContentList(level1, '1', this.listOfLevel1Title, this.listOfLevelsTitle);
      this.createItemOfContentList(level2, '2', this.listOfLevelsTitle);
      this.createItemOfContentList(table, 'table', this.listOfTablesTitle);
      this.createItemOfContentList(image, 'image', this.listOfImagesTitle);
      this.createItemOfContentList(graph, 'graph', this.listOfGraphsTitle);
      this.sortContent(this.listOfLevelsTitle);
      this.sortContent(this.listOfTablesTitle);
      this.sortContent(this.listOfImagesTitle);
      this.sortContent(this.listOfGraphsTitle);
      // console.log(`=== !!! = `, this.listOfLevelsTitle);
    }
  }

  createItemOfContentList(arr, type: string, arrForPush, arrForPush2?) {
    // tslint:disable-next-line: prefer-const
    if (type === 'graph') {
      for (let item of arr.$) {
        if (item) {
          let graphID = item.attributes.getNamedItem('data-marker-graph').value;
          // console.log(`===  = `, item.attributes.getNamedItem('data-marker-graph'));
          let newItem: IContentItem = { type, title: this.getGraphTitleById(graphID), page: Math.floor((item.offsetTop / this.pageHeight) + 1), $: item };
          arrForPush.push(newItem);
        }
      }
    } else {
      for (let item of arr.$) {
        if (item) {
          if (item.innerHTML !== '<br>' && item.innerHTML.length > 0) {
            // tslint:disable-next-line: prefer-const
            let newItem: IContentItem = { type, title: item.innerText, page: Math.floor((item.offsetTop / this.pageHeight) + 1), $: item };
            arrForPush.push(newItem);
            if (arrForPush2) {
              arrForPush2.push(newItem);
            }
          }
        }
      }
    }
  }

  getGraphTitleById(id: string) {
    let graph;
    let graphName = '';
    let graphics = this.samples.find(sample => sample.ID === this.currentSampleId).graphics;
    if (graphics) {
      graph = graphics.find(item => item.graph.ID === id);
      if (graph) {
        graphName = graph.graph.DataJSON.setting.name;
      }
    }
    return graphName;
  }

  detectChangeOfHeaders() {
    // console.log(`=== detectChangeOfHeaders() = `);
    if (this.ckeditor.instance !== null) {
      const level1 = this.ckeditor.instance.document.find(`[header-type=level1]`);
      const level2 = this.ckeditor.instance.document.find(`[header-type=level2]`);
      const table = this.ckeditor.instance.document.find(`[header-type=table]`);
      const image = this.ckeditor.instance.document.find(`[header-type=image]`);
      const graph = this.ckeditor.instance.document.find(`[header-type=graph]`);
      const levels = [];


      for (const item of level2.$) {
        levels.push(item.innerText);
      }

      for (const item of level1.$) {
        levels.push(item.innerText);
      }

      if (this.checkChangeOfHeader(this.listOfLevelsTitle, levels) || this.checkChangeOfHeader(this.listOfTablesTitle, table.$)
        || this.checkChangeOfHeader(this.listOfImagesTitle, image.$) || this.checkChangeOfHeader(this.listOfGraphsTitle, graph.$)) {
        console.log(`=== Headers Changed  = `);

        this.listOfTablesTitle = [];
        this.listOfImagesTitle = [];
        this.listOfGraphsTitle = [];
        this.listOfLevelsTitle = [];
        this.listOfLevel1Title = [];

        this.detectPageOfTitle();
        this.sortContent(this.listOfLevelsTitle);
      }
    }
  }

  checkChangeOfHeader(listOfTitle, newlistOfTitle): boolean {
    let change: boolean = false;
    if (listOfTitle.length !== newlistOfTitle.length) {
      change = true;
      // console.log(`=== changeCheck1 = `, change );
    } else {
      for (let i = 0; i < listOfTitle.length; i++) {
        if (listOfTitle[i].$ !== newlistOfTitle[i]) {
          change = true;
          // console.log(`=== changeCheck 2= `, change);
        }
      }
    }
    // console.log(`=== changeCheck 3= `, change );
    return change;
  }


  sortContent(arr) {
    arr.sort((a, b) => {
      if (a.page > b.page) {
        return 1;
      }
      if (a.page < b.page) {
        return -1;
      }
      return 0;
    });
  }

  navigate(item: IContentItem) {
    this.selectedContentItem = item;
    item.$.scrollIntoView();
  }

  openDialogForInsertContent(): void {
    this.zone.run(() => {
      const dialogRef = this.dialog.open(ModalForInsertContentComponent, {
        width: 'auto',
        data: {
          levelsItems: this.listOfLevelsTitle,
          tablesItems: this.listOfTablesTitle,
          imagesItems: this.listOfImagesTitle,
          graphsItems: this.listOfGraphsTitle
        }
      });

      let dialogRefSubscription = dialogRef.afterClosed().subscribe(result => {
        if (result) {
          let newContent = '<div class="content" content-list = "true" content-list-type = "' + result.contentType + '">' + result.content + '</div>';
          this.ckeditor.instance.insertHtml(newContent);
        }
        dialogRefSubscription.unsubscribe();
      });
    });
  }

  //#endregion CK EDITOR METHODS

  findParentTable(tableAndGraphics: Array<IDataItem>, parentID: string) {
    return tableAndGraphics.find(item => item.ID === parentID);
  }

  downloadAsWord(sampleID: number, ProtocolID?: number) {
    this.saveHTML(this.currentProtocolId);
    setTimeout(() => {
      if (this.currentDocumentType === 'protocol') {
        let url = this.expertCabinetService.apiUrl + `Reports/GetProtocolForSampleAsWordFile?SampleID=${sampleID}&ProtocolID=${ProtocolID}`;
        this.expertCabinetService.setSampleProtocolHtml(ProtocolID, this.documentHtml).subscribe(res => {
          window.open(url);
        });
      }
      if (this.currentDocumentType === 'report') {
        let url = this.expertCabinetService.apiUrl + `Reports/GetReportForApplicationAsWordFile?ApplicationID=${this.application.ID}`;

        this.expertCabinetService.setReportHtml(this.application.ID, this.documentHtml).subscribe(res => {
          window.open(url);
        });
      }
    }, 300);
  }


  uploadFile(file: File) {
    if (this.currentDocumentType === 'report') {
      this.expertCabinetService.setApplicationReportFile(file, this.application.ID).subscribe((event) => {
        if (event.type === HttpEventType.Response) {
          if (event.status === 200) {
            this.loadingApprovedReportMetrikaCall();
            let mes = event.body['resultResponse'];
            this.snackBar.open(mes, '', {
              verticalPosition: 'top',
              horizontalPosition: 'center',
              duration: 3000,
              panelClass: ['succes-snackbar']
            });
            this.expertCabinetService.getApplicationReport(this.application.ID).subscribe(res => {
              if (res && res.ReportFileID) {
                this.reportFile = res;
              }
            });
          } else {
            let mes = event.body['resultResponse'];
            this.snackBar.open(mes, '', {
              verticalPosition: 'top',
              horizontalPosition: 'center',
              duration: 3000,
              panelClass: ['warning-snackbar']
            });
          }
        }
      });
    } else if (this.currentDocumentType === 'protocol') {
      // console.log(this.currentProtocolId);
      this.expertCabinetService.setSampleProtocolFile(file, this.currentProtocolId).subscribe((event) => {
        if (event.type === HttpEventType.Response) {
          if (event.status === 200) {
            this.loadingApprovedProtocolMetrikaCall();
            this.snackBar.open('Протокол успешно загружен', '', {
              verticalPosition: 'top',
              horizontalPosition: 'center',
              duration: 3000,
              panelClass: ['succes-snackbar']
            });
            this.expertCabinetService.getSampleProtocols(this.currentSampleId, this.currentProtocolId).subscribe(res => {
              this.protocolFiles = res;
            });
          }
        }
      });

    }
  }

  removeFile(id: number, type: string) {
    if (confirm('Вы точно хотите удалить выбранный файл?')) {
      let applicationID = null, sampleAnalysisTypeItemID = null;
      if (type === 'report') {
        applicationID = this.application.ID;
      }
      if (type === 'protocol') {
        sampleAnalysisTypeItemID = id;
      }
      this.mainService.delReportProtocolFile(applicationID, sampleAnalysisTypeItemID).subscribe(res => {
        if (type === 'report') {
          this.reportFile.ReportFileID = null;
        }
        if (type === 'protocol') {
          this.protocolFiles[0].ProtocolFileID = null;
        }
        this.eventService.fileIsDeleted.emit(true);
      });
      /*
        this.mainService.delDBFile(id).subscribe(res => {
        if (type === 'report') {
          this.reportFile.ReportFileID = null;
        }
        if (type === 'protocol') {
          this.protocolFiles[0].ProtocolFileID = null;
        }
      }); */
    }
  }

  uploadImage(files: FileList) {
    var file: File = files[0];
    var myReader: FileReader = new FileReader();
    let image;

    myReader.onloadend = (e) => {
      image = '<img style="max-width: 709px;" src="' + myReader.result + '">';
      this.ckeditor.instance.insertHtml(image);
    }
    myReader.readAsDataURL(file);
  }

  trackByFunc(index, item) {
    return index;
  }

  deleteContent() {
    if (this.ckeditor.instance !== null) {
      // tslint:disable-next-line: prefer-const
      let level1 = this.ckeditor.instance.document.find(`[header-type=level1]`);
      // tslint:disable-next-line: prefer-const
      let level2 = this.ckeditor.instance.document.find(`[header-type=level2]`);
      // tslint:disable-next-line: prefer-const
      let table = this.ckeditor.instance.document.find(`[header-type=table]`);
      // tslint:disable-next-line: prefer-const
      let image = this.ckeditor.instance.document.find(`[header-type=image]`);
      // tslint:disable-next-line: prefer-const
      let graph = this.ckeditor.instance.document.find(`[header-type=graph]`);


      level1.$.forEach(element => {
        element.removeAttribute('header-type');
      });
      level2.$.forEach(element => {
        element.removeAttribute('header-type');
      });
      table.$.forEach(element => {
        element.removeAttribute('header-type');
      });
      image.$.forEach(element => {
        element.removeAttribute('header-type');
      });
      graph.$.forEach(element => {
        element.removeAttribute('header-type');
      });

      this.detectChangeOfHeaders();
      this.documentChanged = true;
    }
  }

  // Добавление TemplateID, если его нет
  checkMarkersTemplateID() {
    // this.documentHtmlColtrol.setValue('');
    const parser = new DOMParser();
    let docHtml = parser.parseFromString(this.documentHtmlColtrol.value, 'text/html');
    const markers = docHtml.body.querySelectorAll('.marker');
    // tslint:disable-next-line: prefer-for-of
    for (let index = 0; index < markers.length; index++) {
      let elementId: string;
      let templateId: string;
      const marker: Element = markers[index];

      const markerType: DocMarkerType = marker.getAttribute('data-marker-type') as DocMarkerType;
      if (markerType) {
        if (markerType === 'table' || markerType === 'table-header') {
          elementId = marker.getAttribute('data-marker-table');
          templateId = marker.getAttribute('data-marker-table-templateid');

          if (!templateId) {
            this.templateIdForSubscribe.push(this.expertCabinetService.getTemplateIDByElementID(elementId, this.application.ID));
            this.tablesTemplateId.push({ index: index, id: elementId, completed: false })
          }
        }
        if (markerType === 'table') {
          if (elementId !== 'null') {
            if (this.processedTables.indexOf(elementId) === -1) {
              this.processedTables.push(elementId);
            }
            // this.processedTables.push(templateId);
          }
          //  if (templateId !== 'null') {
          //   if (this.processedTables.indexOf(templateId) === -1) {
          //     this.processedTables.push(templateId);
          //   }
          // }
        }
        if (markerType === 'graph') {
          elementId = marker.getAttribute('data-marker-graph');
          if (elementId) {
            if (this.processedCharts.indexOf(elementId) === -1) {
              this.processedCharts.push(elementId);
            }
          }
          // debugger;
        }
      }
    }

    combineLatest(this.templateIdForSubscribe.length > 0 ? this.templateIdForSubscribe : of([])).subscribe((responses: Array<IResTemplateId>) => {
      responses.map(res => {
        let newMarkerAttr = this.tablesTemplateId.find(x => x.id.toLowerCase() === res.AnalysisTypeItemTemplateID && !x.completed);
        if (newMarkerAttr) {
          markers[newMarkerAttr.index].setAttribute('data-marker-table', res.ID);
          markers[newMarkerAttr.index].setAttribute('data-marker-table-templateid', res.AnalysisTypeItemTemplateID);
          newMarkerAttr.templateId = res.AnalysisTypeItemTemplateID;
          newMarkerAttr.completed = true;
          if (this.processedTables.indexOf(res.AnalysisTypeItemTemplateID) === -1) {
            this.processedTables.push(res.AnalysisTypeItemTemplateID);
          }

          // console.log(`=v== res.ID = `, res.ID);
          // console.log(`=== !!! = `, this.tablesTemplateId);
          // console.log(`=== !!! = `, markers[newMarkerAttr.index]);
        }
      });


      // this.documentHtmlColtrol.setValue('');

      //Поиск комментария HTMl: JSON графиков и таблиц показанных пользователю
      let findComStartIndex = this.documentHtmlColtrol.value.indexOf('<!-- {"processedTables"');
      let findComWithComment = this.documentHtmlColtrol.value.slice(findComStartIndex);
      // // Удаление знаков комментария
      let findCom = findComWithComment.slice(5);
      let findComFinishIndex = findCom.indexOf('}');
      findCom = findCom.slice(0, findComFinishIndex + 1);
      // console.log(findCom);
      // debugger;

      let findComObject;
      if (findCom) {
        findComObject = JSON.parse(findCom);
      }
      // debugger;
      // Для удаления комментария в документе//
      // this.documentHtmlColtrol.setValue(this.documentHtmlColtrol.value.slice(0,findComStartIndex))

      if (findComStartIndex > -1 && findComObject) {
        if (this.processedTables.length < findComObject.processedTables.length || this.processedCharts.length < findComObject.processedCharts.length) {
          this.processedTables = findComObject.processedTables;
          this.processedCharts = findComObject.processedCharts;
          // debugger;
          // console.log('processedTables', this.processedTables);
          // console.log('processedCharts', this.processedCharts);
        }
      }
      // console.log(this.processedTables);


      this.documentHtmlColtrol.setValue(docHtml.documentElement.innerHTML);
      this.startUpdateDocumentMarkers();

    });

  }

  findChildrenOfTablesForMarkers() {
    // Добавление копий таблиц (если их нет) к родительским таблицам
    this.dataForGraph.forEach(item => {
      if (item.Item.DataJSON) {
        let json = JSON.parse(item.Item.DataJSON);
        // console.log(json);
        if (json.tableName !== 'Зависимость вязкости и плотности пластового флюида от давления при снижении давления ниже давления насыщения' &&
          json.tableName !== 'Зависимость вязкости и плотности пластового флюида от температуры') {
          if (this.processedTables.indexOf(item.Item.ID) === -1) {
            this.childrenTablesForMarker.push(item.Item);
            // console.log(item.Item);
            // debugger;
            if (item.Children.length > 0) {
              item.Children.map(chart => {
                // if(chart.Item.DataJSON){
                if (typeof chart.Item.DataJSON == 'string') {
                  chart.Item.DataJSON = JSON.parse(chart.Item.DataJSON);
                }
                this.childrenGraphicsForMarker.push(chart.Item);
                // }
                // debugger;
              });
            }
          }
        }
      }

    });
    // console.log(this.childrenTablesForMarker);
    // console.log(this.processedTables);
    // console.log(this.dataForGraph);

    // Добавление графиков (если их нет) к родительским таблицам
    this.tablesForMarker.map(table => {
      let filteredChart = this.dataForGraph.find(item => item.Item.ID === table.ID).Children;
      if (filteredChart.length > 0) {
        filteredChart.map((chart, index) => {
          let findedChartInReport = this.processedCharts.find(x => x === chart.Item.ID);
          if (!findedChartInReport) {
            if (this.childrenGraphicsForMarker.indexOf(chart.Item) === -1) {
              if (typeof chart.Item.DataJSON == 'string') {
                chart.Item.DataJSON = JSON.parse(chart.Item.DataJSON);
              }
              this.childrenGraphicsForMarker.push(chart.Item);
            }
          }
        });
      }
    });
    // console.log(this.childrenGraphicsForMarker);
    // debugger;


    if (this.childrenTablesForMarker.length > 0 || this.childrenGraphicsForMarker.length > 0) {
      this.showRenderObjectComponentForChildren = true;
    }
    // debugger;

  }

  // Вставка графиков и копий таблиц
  setChildrenChartAndTables(graphicsForPaste: Array<IGraphImage>, tablesForPaste: Array<IHtmlWithId>, docHtml) {
    // debugger;
    // Вставка недостающих таблиц
    tablesForPaste.map(table => {
      if (this.processedTables.indexOf(table.id) === -1) {

        let indexTable;
        // let childrenParentID;
        // let childrenParentAnalysisTypeID;

        this.dataForGraph.map((item, index) => {
          if (item) {
            if (item.Item.ID === table.id) {
              indexTable = index

              // console.log(indexTable);
              // debugger;
              if (indexTable > 0) {
                let graphInReport = [];
                if (this.dataForGraph[index - 1].Children.length > 0) {
                  this.dataForGraph[index - 1].Children.map(graph => {
                    if (this.graphicsForMarker.find(x => x.graph.ID === graph.Item.ID)) {
                      graphInReport.push(graph);
                    }

                  });
                }

                if (graphInReport.length > 0) {
                  let latestGraphFromTablesChildren = docHtml.body.querySelectorAll(`[id="` + graphInReport[graphInReport.length - 1].Item.ID + `"]`);
                  if (latestGraphFromTablesChildren[0]) {
                    let oldElHtml = latestGraphFromTablesChildren[0].outerHTML;
                    latestGraphFromTablesChildren[0].outerHTML = oldElHtml + '<span>&nbsp</span>' + table.html + '<span>&nbsp</span>';
                    this.processedTables.push(table.id);
                  }
                }
                else {
                  let previousTable;
                  let previousTables = docHtml.body.querySelectorAll(`[data-marker-table="` + this.dataForGraph[index - 1].Item.ID + `"]`);
                  if (previousTables.length > 0) {
                    previousTables.forEach(el => {
                      if (el.localName == 'table') {
                        previousTable = el;
                      }
                    });
                    // debugger;
                  } else {
                    let previousTablesByAnalysisTemplateId = docHtml.body.querySelectorAll(`[data-marker-table-templateid="` + this.dataForGraph[index - 1].Item.AnalysisTypeItemTemplateID + `"]`);
                    previousTablesByAnalysisTemplateId.forEach(el => {
                      if (el.localName == 'table') {
                        previousTable = el;
                      }
                    });
                    // debugger;

                  }
                  if (previousTable) {
                    // debugger;
                    let oldElHtml = previousTable.outerHTML;
                    previousTable.outerHTML = oldElHtml + '<span>&nbsp</span>' + table.html + '<span>&nbsp</span>';
                    this.processedTables.push(table.id);

                  }

                }
              } else if (indexTable === 0) {
                let firstTableInReport = docHtml.body.querySelectorAll(`[data-marker-table]`);
                if (firstTableInReport[0]) {
                  let oldElHtml = firstTableInReport[0].outerHTML;
                  firstTableInReport[0].outerHTML = '<span>&nbsp</span>' + table.html + '<span>&nbsp</span>' + oldElHtml;
                  this.processedTables.push(table.id);

                }
              }
            }
          }
        });
      }

    });
    // Вставка child графиков
    graphicsForPaste.map(graph => {
      let indexChildrenCharts;
      let arrayOfChildrenCharts;
      let childrenParentID;
      let childrenParentAnalysisTypeID;

      let haveChildrenCharts = this.dataForGraph.filter(item => item.Children.length > 0);
      haveChildrenCharts.map(x => {
        x.Children.map((child, index) => {
          if (child.Item.ID === graph.id) {
            indexChildrenCharts = index;
            arrayOfChildrenCharts = x.Children;
            childrenParentID = child.Item.ParentID;
            childrenParentAnalysisTypeID = x.Item.AnalysisTypeItemTemplateID;
            // debugger;
          }
        });
      });

      // console.log(indexChildrenCharts);
      // debugger;
      if (indexChildrenCharts > 0) {
        let latestGraphFromTablesChildren = docHtml.body.querySelectorAll(`[id="` + arrayOfChildrenCharts[indexChildrenCharts - 1].Item.ID.toString() + `"]`);
        if (latestGraphFromTablesChildren[0]) {
          let oldElHtml = latestGraphFromTablesChildren[0].outerHTML;
          // debugger;
          latestGraphFromTablesChildren[0].outerHTML = oldElHtml + '<span>&nbsp</span>' + '<img class="marker" data-marker-graph="' + graph.id + '" data-marker-type="graph" src="' + graph.src + '"><span id="' + graph.id + '">&nbsp</span>';
          this.processedCharts.push(graph.id);
        }
      } else {
        let parentTable = docHtml.body.querySelectorAll(`[data-marker-table="` + childrenParentID + `"]`);
        let oldEl;
        let oldElIndex;
        parentTable.forEach((element, index) => {
          if (element.localName == 'table') {
            oldEl = element;
            oldElIndex = index;
          }
        });
        // debugger;
        if (oldEl) {
          let oldElHtml = oldEl.outerHTML;
          // debugger;
          parentTable[oldElIndex].outerHTML = oldElHtml + '<span>&nbsp</span>' + '<img class="marker" data-marker-graph="' + graph.id + '" data-marker-type="graph" src="' + graph.src + '"><span id="' + graph.id + '">&nbsp</span>';
          this.processedCharts.push(graph.id);

        } else {
          parentTable = docHtml.body.querySelectorAll(`[data-marker-table-templateid="` + childrenParentAnalysisTypeID + `"]`);
          // debugger;
          let oldElByTemplateId;
          let oldElByTemplateIdIndex;
          parentTable.forEach((element, index) => {
            if (element.localName == 'table') {
              oldElByTemplateId = element;
              oldElByTemplateIdIndex = index;
            }
          });
          // debugger;
          if (oldElByTemplateId) {
            let oldElByTemplateIdHtml = oldElByTemplateId.outerHTML;
            // debugger;
            parentTable[oldElByTemplateIdIndex].outerHTML = oldElByTemplateIdHtml + '<span>&nbsp</span>' + '<img class="marker" data-marker-graph="' + graph.id + '" data-marker-type="graph" src="' + graph.src + '"><span id="' + graph.id + '">&nbsp</span>';
            this.processedCharts.push(graph.id);

          }
        }

      }

    });
    return docHtml;

  }

  @HostListener('window:beforeunload')
  ngOnDestroy() {
    this.componentIsAlive = false;
    this.subscriptions.map(elem => {
      elem.unsubscribe();
    });
    this.subscriptions.length = 0;
    this.editorIsReady.unsubscribe();
    // if (this.tableDataValue.value !== this.initialTableValue) {
    //   if (confirm('Хотите сохранить изменения перед переходом?')) {
    //     this.saveTable();
    //   }
    // }
    this.titleService.setTitle('Lims');
  }


  //#region Yandex Metrika
  /** Отправка данных в Яндекс метрику об изменении в протоколе */
  editProtocolMetrikaCall() {
    let params = {
      applicationNumber: this.application.AppNum,
      protocolName: this.protocolsForTabs[this.currentProtocolIndex].protocolName,
    };
    this.yandexMetrika.send('PROTOCOL_EDITING', params);
  }

  /** Отправка данных в Яндекс метрику об изменении в отчете */
  editReportMetrikaCall() {
    let params = {
      applicationNumber: this.application.AppNum,
    };
    this.yandexMetrika.send('REPORT_EDITING', params);
  }

  /** Отправка данных в Яндекс метрику о загрузке утвержденного отчета */
  loadingApprovedReportMetrikaCall() {
    let params = {
      applicationNumber: this.application.AppNum,
    };
    this.yandexMetrika.send('LOADING_APPROVED_REPORT', params);
  }

  /** Отправка данных в Яндекс метрику о загрузке утвержденного протокола */
  loadingApprovedProtocolMetrikaCall() {
    let params = {
      applicationNumber: this.application.AppNum,
      protocolName: this.protocolsForTabs[this.currentProtocolIndex].protocolName,
    };
    this.yandexMetrika.send('LOADING_APPROVED_PROTOCOL', params);
  }

  //#endregion Yandex Metrika

}

export interface IProtocolFile {
  ProtocolID: number;
  ProtocolTitle: string;
  ProtocolHTML: string;
  ProtocolFileID: number;
}
